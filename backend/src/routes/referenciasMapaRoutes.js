const router = require('express').Router();
const ReferenciaMapa = require('../models/ReferenciaMapa');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { identificadorValido } = require('../services/acessoVeiculo');
const { normalizarIconeMapa } = require('../services/iconesMapa');
const { pontoValido } = require('../operacao/roteirizacao');

const editar = authorize('admin', 'gestor');
const falha = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });
const tratar = acao => async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    return await acao(req, res);
  } catch {
    return falha(res, 503, 'Não foi possível acessar os pontos de referência.');
  }
};

const empresa = req => ({ clienteId: req.user.clienteId });
function validar(body) {
  const { nome, latitude, longitude, iconeMapa } = body || {};
  const icone = normalizarIconeMapa(iconeMapa, 'lugar');
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 100 ||
      !pontoValido({ latitude, longitude }) || !icone) return null;
  return { nome: nome.trim(), latitude, longitude, iconeMapa: icone };
}

router.use(authenticate);
router.get('/', tratar(async (req, res) => {
  const dados = await ReferenciaMapa.find(empresa(req)).select('nome latitude longitude iconeMapa').sort({ nome: 1, _id: 1 }).lean();
  return res.json({ sucesso: true, dados });
}));
router.post('/', editar, tratar(async (req, res) => {
  const payload = validar(req.body);
  if (!payload) return falha(res, 400, 'Informe o nome, um ponto no mapa e um ícone válido.');
  const dados = await ReferenciaMapa.create({ ...empresa(req), ...payload });
  return res.status(201).json({ sucesso: true, dados });
}));
router.put('/:id', editar, tratar(async (req, res) => {
  if (!identificadorValido(req.params.id)) return falha(res, 404, 'Ponto de referência não encontrado.');
  const payload = validar(req.body);
  if (!payload) return falha(res, 400, 'Informe o nome, um ponto no mapa e um ícone válido.');
  const dados = await ReferenciaMapa.findOneAndUpdate({ ...empresa(req), _id: req.params.id },
    { $set: payload }, { returnDocument: 'after', runValidators: true }).lean();
  if (!dados) return falha(res, 404, 'Ponto de referência não encontrado.');
  return res.json({ sucesso: true, dados });
}));
router.delete('/:id', editar, tratar(async (req, res) => {
  if (!identificadorValido(req.params.id)) return falha(res, 404, 'Ponto de referência não encontrado.');
  const resultado = await ReferenciaMapa.deleteOne({ ...empresa(req), _id: req.params.id });
  if (!resultado.deletedCount) return falha(res, 404, 'Ponto de referência não encontrado.');
  return res.json({ sucesso: true });
}));

module.exports = router;
