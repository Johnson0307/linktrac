const router = require('express').Router();
const { authorize } = require('../middlewares/authorizationMiddleware');
const RotaMapa = require('../models/RotaMapa');
const Motorista = require('../models/Motorista');
const Usuario = require('../models/Usuario');
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const { Registro } = require('./modelos');
const { id } = require('./validacao');
const { pontoValido, passagensValidas, rotaEntrePontos } = require('./roteirizacao');
const { obterBase, radarAdiante } = require('./fiscalizacao');

const editar = authorize('admin', 'gestor');
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const falha = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });
const tratar = fn => async (req, res) => {
  try {
    res.set('Cache-Control', 'private, no-store');
    await fn(req, res);
  } catch {
    return falha(res, 503, 'Não foi possível acessar as rotas atribuídas.');
  }
};
const empresa = req => ({ clienteId: req.user.clienteId });
const visiveis = req => ({
  ...empresa(req),
  ...(req.motoristaId ? { motoristaId: req.motoristaId, canceladaEm: { $exists: false } } : {}),
});

const preencher = (consulta, req) => consulta.populate({
  path: 'veiculoId', select: 'placa marca modelo', match: empresa(req),
}).populate({ path: 'motoristaId', select: 'nome', match: empresa(req) });

router.get('/', tratar(async (req, res) => {
  const registros = await preencher(RotaMapa.find(visiveis(req))
    .select('titulo veiculoId motoristaId porRuas distanciaKm duracaoSegundos createdAt canceladaEm')
    .sort({ createdAt: -1, _id: -1 }).limit(51), req).lean();
  return res.json({ sucesso: true, dados: registros.slice(0, 50), limitado: registros.length > 50 });
}));

router.get('/:id/alerta-viario', tratar(async (req, res) => {
  if (!req.motoristaId || !id(req.params.id)) return falha(res, 404, 'Rota indisponível.');
  const rota = await RotaMapa.findOne({ ...visiveis(req), _id: req.params.id })
    .select('veiculoId createdAt').lean();
  if (!rota || !await Veiculo.exists({ ...empresa(req), _id: rota.veiculoId, ativo: { $ne: false } })) {
    return falha(res, 404, 'Rota indisponível.');
  }
  const agora = Date.now();
  const [base, [atual, anterior]] = await Promise.all([
    obterBase(),
    Localizacao.find({
      veiculoId: rota.veiculoId, fonte: 'dispositivo',
      dataHora: { $gte: new Date(Math.max(agora - 45000, +rota.createdAt)), $lte: new Date(agora) },
    }).sort({ dataHora: -1, _id: -1 }).limit(2)
      .select('latitude longitude velocidade dataHora fonte').lean(),
  ]);
  const gpsRecente = Boolean(atual && anterior && agora - +atual.dataHora <= 15000);
  return res.json({
    sucesso: true, disponivel: Boolean(base), gpsRecente,
    dados: gpsRecente ? radarAdiante(base, atual, anterior) : null,
  });
}));

router.get('/:id', tratar(async (req, res) => {
  if (!id(req.params.id)) return falha(res, 404, 'Rota indisponível.');
  const dados = await preencher(RotaMapa.findOne({ ...visiveis(req), _id: req.params.id })
    .select('+geometria -chave'), req).lean();
  if (!dados) return falha(res, 404, 'Rota indisponível.');
  return res.json({ sucesso: true, dados });
}));

router.post('/', editar, tratar(async (req, res) => {
  const { chave, titulo = '', origem, destino, passagens = [], veiculoId, motoristaId } = req.body || {};
  if (typeof chave !== 'string' || !uuid.test(chave) || typeof titulo !== 'string' || titulo.length > 80 ||
      !pontoValido(origem) || !pontoValido(destino) || !passagensValidas(passagens) || !id(veiculoId) ||
      (motoristaId !== undefined && !id(motoristaId)) ||
      (origem.latitude === destino.latitude && origem.longitude === destino.longitude)) {
    return falha(res, 400, 'Confira o veículo e escolha uma partida e um destino diferentes.');
  }
  const filtro = { ...empresa(req), chave };
  const existente = await RotaMapa.findOne(filtro).select('_id').lean();
  if (existente) return res.json({ sucesso: true, dados: { _id: existente._id } });

  const veiculo = await Veiculo.findOne({ ...empresa(req), _id: veiculoId }).select('placa').lean();
  if (!veiculo) return falha(res, 404, 'Selecione um veículo da sua empresa.');
  let responsavel = motoristaId;
  if (!responsavel) {
    const agora = new Date().toISOString();
    const vinculos = await Registro.find({
      ...empresa(req), tipo: 'vinculos', 'dados.veiculoId': veiculoId, 'dados.inicio': { $lte: agora },
      $or: [{ 'dados.fim': { $exists: false } }, { 'dados.fim': { $gt: agora } }],
    }).select('dados.motoristaId').limit(2).lean();
    if (vinculos.length !== 1) return falha(res, 422, 'Escolha o motorista ou cadastre um vínculo ativo para o veículo.');
    responsavel = vinculos[0].dados.motoristaId;
  }
  const motorista = await Motorista.findOne({ ...empresa(req), _id: responsavel, status: 'ativo' }).select('email').lean();
  if (!motorista?.email) return falha(res, 422, 'Escolha um motorista ativo com e-mail cadastrado.');
  const [conta, cadastros] = await Promise.all([
    Usuario.exists({ ...empresa(req), email: motorista.email, role: 'motorista', ativo: { $ne: false } }),
    Motorista.countDocuments({ ...empresa(req), email: motorista.email, status: 'ativo' }),
  ]);
  if (!conta || cadastros !== 1) {
    return falha(res, 422, 'Confira se há um único cadastro ativo com o mesmo e-mail da conta de motorista.');
  }

  const a = { latitude: origem.latitude, longitude: origem.longitude };
  const b = { latitude: destino.latitude, longitude: destino.longitude };
  const vias = passagens.map(({ latitude, longitude }) => ({ latitude, longitude }));
  let percurso;
  try {
    const { geometria, porRuas, provedor, distanciaKm, duracaoSegundos } = await rotaEntrePontos(a, b, vias);
    percurso = { geometria, porRuas, provedor, distanciaKm, duracaoSegundos };
  } catch {
    return falha(res, 502, 'O roteador está indisponível. Tente publicar novamente.');
  }
  await RotaMapa.init();
  try {
    const dados = await RotaMapa.create({
      ...filtro, titulo: titulo.trim() || `Rota · ${veiculo.placa}`, veiculoId, motoristaId: responsavel,
      origem: a, destino: b, passagens: vias, ...percurso,
    });
    return res.status(201).json({ sucesso: true, dados: { _id: dados._id } });
  } catch (erro) {
    if (erro.code !== 11000) throw erro;
    const dados = await RotaMapa.findOne(filtro).select('_id').lean();
    if (!dados) throw erro;
    return res.json({ sucesso: true, dados });
  }
}));

router.put('/:id/cancelar', editar, tratar(async (req, res) => {
  if (!id(req.params.id)) return falha(res, 404, 'Rota indisponível.');
  const filtro = { ...empresa(req), _id: req.params.id };
  const dados = await RotaMapa.findOneAndUpdate({ ...filtro, canceladaEm: { $exists: false } },
    { $set: { canceladaEm: new Date() } }, { returnDocument: 'after' }).select('canceladaEm').lean()
    || await RotaMapa.findOne(filtro).select('canceladaEm').lean();
  if (!dados) return falha(res, 404, 'Rota indisponível.');
  return res.json({ sucesso: true, dados });
}));

module.exports = router;
