const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { identificadorValido } = require('../services/acessoVeiculo');
const Cliente = require('../models/Cliente');
const Veiculo = require('../models/Veiculo');
const { Conta, Cadastro, validarDados, conectarAsaas, destinoDaConta, falha } = require('../services/cadastroFinanceiro');
const { compilar, preencherContrato, tipoWord, tamanhoLimite, camposContrato } = require('../services/contratoCliente');
const { obterPrevia, salvarPlano } = require('../services/previaCobranca');

const router = express.Router();
router.use(authenticate, authorize('admin'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!adminDaLinktrac(req.user) && !req.user.podeGerenciarCarteira) {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso restrito à administração da carteira.' });
  }
  next();
});
const tratar = (acao) => async (req, res) => {
  try {
    return await acao(req, res);
  } catch (e) {
    return res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'O cadastro financeiro está temporariamente indisponível.' });
  }
};
const responder = (res, dados) => res.json({ sucesso: true, dados });
const arquivo = express.raw({ type: 'application/octet-stream', limit: tamanhoLimite, inflate: false });
function lerArquivo(req, extensao) {
  const nome = req.query.nome;
  if (typeof nome !== 'string' || nome.length > 150 || !nome.toLowerCase().endsWith(extensao) ||
      /[\/\\\x00-\x1f\x7f]/.test(nome) || !Buffer.isBuffer(req.body) || !req.body.length) {
    throw falha(400, `Selecione um arquivo ${extensao} de até 4 MB.`);
  }
  return { nome, bytes: req.body };
}
function baixar(res, nome, tipo, bytes) {
  return res.set('X-Content-Type-Options', 'nosniff').attachment(nome).type(tipo).send(bytes);
}

router.get('/configuracao', tratar(async (req, res) => {
  const conta = await Conta.findById(req.user.clienteId).select('provedor ambiente modeloNome').lean();
  return responder(res, { ...conta, camposContrato });
}));
router.put('/configuracao/asaas', tratar(async (req, res) => responder(res, await conectarAsaas(req.user.clienteId, req.body))));
router.put('/configuracao/modelo', arquivo, tratar(async (req, res) => {
  const { nome, bytes } = lerArquivo(req, '.docx');
  compilar(bytes);
  await Conta.updateOne({ _id: req.user.clienteId }, { $set: { modelo: bytes, modeloNome: nome } }, { upsert: true });
  return responder(res, { modeloNome: nome });
}));

router.param('clienteId', (req, res, next, clienteId) => tratar(async () => {
  if (!identificadorValido(clienteId) || clienteId === String(req.user.clienteId)) throw falha(404, 'Cliente da carteira não encontrado.');
  const filtro = { _id: clienteId, revendedoraId: adminDaLinktrac(req.user) ? { $exists: false } : req.user.clienteId };
  const cliente = await Cliente.findOne(filtro).select('nome cnpj ativo tipo').lean();
  if (!cliente) throw falha(404, 'Cliente da carteira não encontrado.');
  req.clienteFinanceiro = cliente;
  req.filtroFinanceiro = { _id: cliente._id, emissorId: req.user.clienteId };
  next();
})(req, res));

router.get('/clientes/:clienteId/previa', tratar(async (req, res) =>
  responder(res, await obterPrevia(req.user.clienteId, req.clienteFinanceiro))));
router.post('/clientes/:clienteId/previa', tratar(async (req, res) => {
  const { valores, adicionais } = req.body || {};
  return responder(res, await obterPrevia(req.user.clienteId, req.clienteFinanceiro, { valores, adicionais }));
}));

router.put('/clientes/:clienteId/plano', tratar(async (req, res) => {
  await salvarPlano(req.user, req.clienteFinanceiro, req.body?.valores);
  return responder(res, await obterPrevia(req.user.clienteId, req.clienteFinanceiro));
}));

router.get('/clientes/:clienteId', tratar(async (req, res) => {
  const [conta, cadastro, veiculos] = await Promise.all([
    Conta.findById(req.user.clienteId).select('provedor ambiente carteira modeloNome').lean(),
    Cadastro.findOne(req.filtroFinanceiro).select('dados estado destino criadoNoBancoEm contratoNome contratoAnexadoEm').lean(),
    Veiculo.find({ clienteId: req.clienteFinanceiro._id }).select('placa marca modelo ano').sort({ placa: 1, _id: 1 }).lean(),
  ]);
  const mesmaConta = !cadastro?.destino || conta?.provedor && cadastro.destino === destinoDaConta(conta);
  return responder(res, {
    cliente: req.clienteFinanceiro, dados: cadastro?.dados, estado: mesmaConta ? cadastro?.estado : 'conta_alterada',
    ambiente: conta?.ambiente, modeloNome: conta?.modeloNome, contratoNome: cadastro?.contratoNome,
    travado: Boolean(cadastro?.destino) && !(mesmaConta && cadastro?.estado === 'dados_rejeitados'),
    contratoAnexadoEm: cadastro?.contratoAnexadoEm, criadoNoBancoEm: cadastro?.criadoNoBancoEm, veiculos,
  });
}));

router.put('/clientes/:clienteId/pagador', tratar(async (req, res) => {
  const dados = validarDados(req.body);
  const filtro = req.filtroFinanceiro;
  const conta = await Conta.findById(req.user.clienteId).select('provedor ambiente carteira').lean();
  const atual = await Cadastro.findOneAndUpdate({ ...filtro, $or: [
    { estado: 'pendente', destino: { $exists: false } },
    ...(conta?.provedor ? [{ estado: 'dados_rejeitados', destino: destinoDaConta(conta) }] : []),
  ] }, { $set: { dados, estado: 'pendente', proximaTentativa: new Date() } });
  if (!atual) {
    try {
      await Cadastro.create({ ...filtro, dados, estado: 'pendente', proximaTentativa: new Date() });
    } catch (e) {
      if (e.code === 11000) throw falha(409, 'O cadastro já está em sincronização ou vinculado ao banco. Confira o status.');
      throw e;
    }
  }
  return responder(res, { estado: 'pendente' });
}));

router.post('/clientes/:clienteId/gerar-contrato', tratar(async (req, res) => {
  const ids = req.body?.veiculos;
  if (!Array.isArray(ids) || ids.length > 5000 || new Set(ids).size !== ids.length || !ids.every(identificadorValido)) {
    throw falha(400, 'Confira os veículos selecionados.');
  }
  const [conta, prestadora, cadastro, veiculos] = await Promise.all([
    Conta.findById(req.user.clienteId).select('+modelo').lean(),
    Cliente.findById(req.user.clienteId).select('nome cnpj').lean(),
    Cadastro.findOne(req.filtroFinanceiro).select('dados').lean(),
    Veiculo.find({ _id: { $in: ids }, clienteId: req.clienteFinanceiro._id }).select('placa marca modelo ano').sort({ placa: 1 }).lean(),
  ]);
  if (!conta?.modelo || !cadastro?.dados || !prestadora) throw falha(409, 'Salve os dados do pagador e suba o modelo Word da empresa.');
  if (veiculos.length !== ids.length) throw falha(404, 'Um dos veículos não pertence ao cliente.');
  const bytes = preencherContrato(Buffer.isBuffer(conta.modelo) ? conta.modelo : conta.modelo.value(), prestadora, cadastro.dados, veiculos);
  return baixar(res, 'contrato-preenchido.docx', tipoWord, bytes);
}));

router.put('/clientes/:clienteId/contrato', arquivo, tratar(async (req, res) => {
  const { nome, bytes } = lerArquivo(req, '.pdf');
  if (bytes.subarray(0, 5).toString() !== '%PDF-' || !bytes.subarray(-1024).toString().includes('%%EOF')) {
    throw falha(422, 'O arquivo deve ser um PDF válido.');
  }
  const contratoAnexadoEm = new Date();
  const atualizado = await Cadastro.updateOne(req.filtroFinanceiro, { $set: { contrato: bytes, contratoNome: nome, contratoAnexadoEm } });
  if (!atualizado.matchedCount) throw falha(409, 'Salve os dados do pagador antes de anexar o contrato.');
  return responder(res, { contratoNome: nome, contratoAnexadoEm });
}));
router.get('/clientes/:clienteId/contrato', tratar(async (req, res) => {
  const cadastro = await Cadastro.findOne(req.filtroFinanceiro).select('+contrato contratoNome').lean();
  if (!cadastro?.contrato) throw falha(404, 'Nenhum contrato foi anexado.');
  return baixar(res, cadastro.contratoNome, 'application/pdf',
    Buffer.isBuffer(cadastro.contrato) ? cadastro.contrato : cadastro.contrato.value());
}));
router.use((e, _req, res, _next) => res.status(e.status || 503).json({
  sucesso: false, mensagem: e.status === 413 ? 'O limite do arquivo é 4 MB.' : 'Não foi possível receber o arquivo.',
}));

module.exports = router;
