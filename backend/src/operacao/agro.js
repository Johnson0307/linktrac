const router = require('express').Router();
const mongoose = require('mongoose');
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const { consultarHistorico } = require('../services/historicoArquivo');
const { prepararTalhao, calcularArea } = require('./areaAgricola');
const { id, horario } = require('./validacao');

const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nome: { type: String, required: true },
  vertices: [{ _id: false, latitude: Number, longitude: Number }],
}, { timestamps: true });
schema.index({ clienteId: 1, nome: 1 }, { unique: true });
const Talhao = mongoose.model('Talhao', schema);
const limitePosicoes = 4000;
const daEmpresa = req => ({ clienteId: req.user.clienteId });
const tratar = acao => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    return await acao(req, res);
  } catch (e) {
    if (e.code === 11000) return res.status(409).json({ sucesso: false, mensagem: 'Já existe um talhão com este nome na empresa.' });
    return res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Não foi possível concluir a consulta agrícola.' });
  }
};
const responder = (res, dados) => res.json({ sucesso: true, dados });
const falha = (status, mensagem) => { throw Object.assign(new Error(mensagem), { status }); };
const dadosDeTalhao = talhao => ({ ...talhao, areaHa: prepararTalhao(talhao.vertices).area / 10000 });

function lerTalhao(body) {
  const { nome, vertices } = body || {};
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 100) falha(400, 'Informe o nome do talhão.');
  prepararTalhao(vertices);
  return { nome: nome.trim(), vertices: vertices.map(({ latitude, longitude }) => ({ latitude, longitude })) };
}

router.get('/', tratar(async (req, res) => {
  const [talhoes, maquinas] = await Promise.all([
    Talhao.find(daEmpresa(req)).sort({ nome: 1 }).limit(300).lean(),
    Veiculo.find(daEmpresa(req)).select('placa marca modelo').sort({ placa: 1 }).limit(1000).lean(),
  ]);
  return responder(res, { talhoes: talhoes.map(dadosDeTalhao), maquinas });
}));

router.post('/', tratar(async (req, res) => {
  const dados = lerTalhao(req.body);
  await Talhao.init();
  const criado = await Talhao.create({ ...daEmpresa(req), ...dados });
  return res.status(201).json({ sucesso: true, dados: dadosDeTalhao(criado.toObject()) });
}));

router.put('/:id', tratar(async (req, res) => {
  if (!id(req.params.id)) falha(404, 'Talhão não encontrado.');
  const dados = lerTalhao(req.body);
  const talhao = await Talhao.findOneAndUpdate({ ...daEmpresa(req), _id: req.params.id }, { $set: dados }, { new: true }).lean();
  if (!talhao) falha(404, 'Talhão não encontrado.');
  return responder(res, dadosDeTalhao(talhao));
}));

router.get('/maquinas/:id/posicao', tratar(async (req, res) => {
  if (!id(req.params.id) || !(await Veiculo.exists({ ...daEmpresa(req), _id: req.params.id }))) falha(404, 'Máquina não encontrada.');
  const posicao = await Localizacao.findOne({ veiculoId: req.params.id, status: { $ne: 'Sem sinal' }, fonte: { $ne: 'simulado' } })
    .select('latitude longitude dataHora').sort({ dataHora: -1, _id: -1 }).lean();
  if (!posicao) falha(404, 'Esta máquina ainda não tem uma posição válida.');
  return responder(res, posicao);
}));

router.get('/:id/area', tratar(async (req, res) => {
  const { veiculoId, inicio, fim, largura } = req.query;
  if (!id(req.params.id) || !id(veiculoId) || !horario(inicio) || !horario(fim) ||
      Date.parse(fim) <= Date.parse(inicio) || Date.parse(fim) - Date.parse(inicio) > 86400000 ||
      typeof largura !== 'string' || !/^\d{1,2}(\.\d{1,2})?$/.test(largura) || Number(largura) < 1 || Number(largura) > 60) {
    falha(400, 'Selecione talhão, máquina, intervalo de até 24 horas e largura de 1 a 60 metros.');
  }
  const [talhao, veiculo] = await Promise.all([
    Talhao.findOne({ ...daEmpresa(req), _id: req.params.id }).lean(),
    Veiculo.exists({ ...daEmpresa(req), _id: veiculoId, $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }] }),
  ]);
  if (!talhao || !veiculo) falha(404, 'Talhão ou máquina real não encontrado nesta empresa.');
  const pontos = await consultarHistorico(Localizacao, {
    veiculoId, fonte: 'dispositivo', dataHora: { $gte: new Date(inicio), $lte: new Date(fim) },
  }, { campos: 'latitude longitude ignicao status velocidade dataHora', ordem: 1, limite: limitePosicoes + 1, maxTimeMS: 10000 });
  if (pontos.length > limitePosicoes) falha(422, 'O intervalo tem muitas posições. Reduza o período.');
  return responder(res, { ...calcularArea(talhao.vertices, pontos, Number(largura)), posicoes: pontos.length });
}));

module.exports = router;
