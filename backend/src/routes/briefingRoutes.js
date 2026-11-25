const router = require('express').Router();
const { timingSafeEqual } = require('node:crypto');
const { authenticate } = require('../middlewares/authMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { identificadorValido } = require('../services/acessoVeiculo');
const { interpretarBriefing } = require('../services/interpretarBriefing');

const { Edicao, estados, registrarEdicoes } = require('../services/briefingFila');

function central(req, res, next) {
  if (!adminDaLinktrac(req.user)) return res.status(403).json({ sucesso: false, mensagem: 'Acesso restrito à administração central.' });
  return next();
}

const tratar = acao => async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return await acao(req, res);
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível atualizar a fila de briefings.' });
  }
};

const importar = tratar(async (req, res) => {
  let edicoes;
  try { edicoes = interpretarBriefing(req.body?.texto); }
  catch (e) { return res.status(400).json({ sucesso: false, mensagem: e.message }); }
  const clienteId = req.user?.clienteId || process.env.LINKTRAC_CLIENT_ID;
  const novas = await registrarEdicoes(clienteId, edicoes, req.user?.email || 'integração');
  return res.status(novas ? 201 : 200).json({ sucesso: true, novas, repetidas: edicoes.length - novas });
});

router.post('/receber', (req, res, next) => {
  const esperado = process.env.BRIEFING_INGEST_TOKEN;
  const recebido = req.get('x-briefing-token');
  if (!process.env.LINKTRAC_CLIENT_ID || !esperado || esperado.length < 32) {
    return res.status(503).json({ sucesso: false, mensagem: 'Recebimento automático não configurado.' });
  }
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido || '');
  if (a.length !== b.length || !timingSafeEqual(a, b)) return res.status(401).json({ sucesso: false });
  return next();
}, importar);

router.use(authenticate, central);
router.post('/edicoes-disponiveis', tratar(async (req, res) => {
  const edicoes = require('../data/briefings-propostas-ate-2026-11-23.json');
  const datas = await Edicao.distinct('data', { clienteId: req.user.clienteId });
  const pendentes = edicoes.filter(e => !datas.includes(e.data));
  const novas = await registrarEdicoes(req.user.clienteId, pendentes, req.user.email);
  return res.status(novas ? 201 : 200).json({ sucesso: true, novas, repetidas: edicoes.length - novas,
    aviso: 'Propostas importadas para revisão. Importar não implementa nem publica funções automaticamente.' });
}));
router.post('/', importar);
router.get('/', tratar(async (req, res) => {
  const dados = await Edicao.find({ clienteId: req.user.clienteId }).select('-hash')
    .sort({ data: -1, _id: -1 }).limit(101).lean();
  return res.json({ sucesso: true, dados: dados.slice(0, 100), limitado: dados.length > 100 });
}));
router.patch('/:edicao/itens/:item', tratar(async (req, res) => {
  const { edicao, item } = req.params;
  const { status, anterior } = req.body || {};
  if (!identificadorValido(edicao) || !identificadorValido(item) || !estados.includes(status) || !estados.includes(anterior)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Informe uma situação válida.' });
  }
  const dados = await Edicao.findOneAndUpdate({
    _id: edicao, clienteId: req.user.clienteId, itens: { $elemMatch: { id: item, status: anterior } },
  }, { $set: { 'itens.$.status': status, 'itens.$.revisadoEm': new Date(), 'itens.$.revisadoPor': req.user.email } },
  { returnDocument: 'after' }).select('-hash').lean();
  if (!dados) return res.status(409).json({ sucesso: false, mensagem: 'A proposta mudou. Atualize a fila e tente novamente.' });
  return res.json({ sucesso: true, dados });
}));

module.exports = router;
