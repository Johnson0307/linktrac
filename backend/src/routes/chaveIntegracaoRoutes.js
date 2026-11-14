const router = require('express').Router({ mergeParams: true });
const { createHash, randomBytes } = require('node:crypto');
const Cliente = require('../models/Cliente');
const { ChaveIntegracao, permissoesIntegracao } = require('../models/ChaveIntegracao');
const { authenticate } = require('../middlewares/authMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { permite } = require('../services/acessosCliente');
const { escopoEmpresa } = require('../services/carteiraRevenda');
const { identificadorValido } = require('../services/acessoVeiculo');

const falha = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });
const tratar = acao => async (req, res, next) => {
  try {
    res.set('Cache-Control', 'no-store');
    await acao(req, res, next);
  } catch {
    return falha(res, 503, 'Não foi possível gerenciar as chaves de integração.');
  }
};

router.use(authenticate, tratar(async (req, res, next) => {
  if (!adminDaLinktrac(req.user)) return falha(res, 403, 'Somente a administração Linktrac gerencia chaves de integração.');
  if (!identificadorValido(req.params.clienteId)) return falha(res, 404, 'Cliente não encontrado.');
  const empresa = await Cliente.findById(req.params.clienteId).select('acessos ativo revendedoraId').lean();
  if (!empresa) return falha(res, 404, 'Cliente não encontrado.');
  const escopo = await escopoEmpresa(empresa);
  req.empresaIntegrada = { ...empresa, acessos: escopo?.acessos, ativo: Boolean(escopo) };
  next();
}));

router.get('/', tratar(async (req, res) => {
  const { _id: clienteId, acessos, ativo } = req.empresaIntegrada;
  const { antes } = req.query;
  if (antes !== undefined && !identificadorValido(antes)) return falha(res, 400, 'Cursor inválido.');
  const todas = Object.entries(permissoesIntegracao).map(([id, p]) => ({
    id, nome: p.nome, disponivel: ativo !== false && permite(acessos, p.modulo, p.alterar),
  }));
  const chaves = await ChaveIntegracao.find({ clienteId, ...(antes ? { _id: { $lt: antes } } : {}) })
    .select('nome permissoes createdAt revogadaEm').sort({ _id: -1 }).limit(101).lean();
  return res.json({ sucesso: true, dados: { chaves: chaves.slice(0, 100), permissoes: todas,
    proximo: chaves.length > 100 ? chaves[99]._id : null } });
}));

router.post('/', tratar(async (req, res) => {
  const { nome, permissoes } = req.body || {};
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 100 || !Array.isArray(permissoes) ||
      !permissoes.length || permissoes.length > Object.keys(permissoesIntegracao).length ||
      permissoes.some(p => typeof p !== 'string' || !Object.hasOwn(permissoesIntegracao, p)) ||
      new Set(permissoes).size !== permissoes.length) {
    return falha(res, 400, 'Informe o nome do sistema e selecione pelo menos uma permissão válida.');
  }
  const { _id: clienteId, acessos, ativo } = req.empresaIntegrada;
  if (ativo === false || permissoes.some(id => {
    const p = permissoesIntegracao[id];
    return !permite(acessos, p.modulo, p.alterar);
  })) return falha(res, 403, 'A empresa precisa ter os módulos correspondentes liberados.');
  const segredo = randomBytes(32).toString('hex');
  const doc = await ChaveIntegracao.create({
    clienteId, nome, permissoes, hash: createHash('sha256').update(segredo).digest('hex'),
  });
  return res.status(201).json({ sucesso: true, dados: {
    _id: doc.id, nome: doc.nome, permissoes, createdAt: doc.createdAt, chave: `ltp_${doc.id}_${segredo}`,
  } });
}));

router.post('/:id/revogar', tratar(async (req, res) => {
  if (!identificadorValido(req.params.id)) return falha(res, 404, 'Chave não encontrada.');
  const filtro = { _id: req.params.id, clienteId: req.empresaIntegrada._id };
  const dados = await ChaveIntegracao.findOneAndUpdate({ ...filtro, revogadaEm: { $exists: false } },
    { $set: { revogadaEm: new Date() } }, { returnDocument: 'after' }).select('revogadaEm').lean()
    || await ChaveIntegracao.findOne(filtro).select('revogadaEm').lean();
  if (!dados) return falha(res, 404, 'Chave não encontrada.');
  return res.json({ sucesso: true, dados });
}));

module.exports = router;
