const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const Motorista = require('../models/Motorista');
const Veiculo = require('../models/Veiculo');
const { Registro } = require('./modelos');
const { id, horario, validar } = require('./validacao');
const { pontoValido, localizar, planejar } = require('./roteirizacao');
const { simularCarga } = require('./trocasConteiner');

const etapasConteiner = ['retirada', 'entrega', 'devolucao'];
const pendentes = ['pendente', 'em_rota'];
const encerradas = ['entregue', 'cancelada'];
const tamanhoFoto = 350 * 1024;
const lerConclusao = express.json({ limit: '480kb' });

function falha(status, mensagem) {
  throw Object.assign(new Error(mensagem), { status });
}

const tratar = acao => async (req, res, next) => {
  try {
    await acao(req, res, next);
  } catch (e) {
    const status = e.code === 11000 ? 409 : e.status || 503;
    const mensagem = e.code === 11000 ? 'Esta nota ou etiqueta já está cadastrada.'
      : e.status ? e.message : 'Não foi possível concluir a operação do TMS.';
    return res.status(status).json({ sucesso: false, mensagem });
  }
};

router.use(authenticate, authorize('admin', 'gestor', 'motorista'));
router.use(tratar(async (req, res, next) => {
  if (req.user.role === 'motorista') {
    const motoristas = await Motorista.find({
      clienteId: req.user.clienteId, email: req.user.email, status: 'ativo',
    }).select('_id').limit(2).lean();
    if (motoristas.length !== 1) {
      falha(403, 'Peça ao gestor para conferir o cadastro ativo de motorista com o mesmo e-mail da sua conta.');
    }
    req.motoristaId = String(motoristas[0]._id);
  }
  next();
}));

router.use('/rotas-mapa', require('./rotasMapa'));

const escopo = req => ({
  clienteId: req.user.clienteId, tipo: 'cargas',
  ...(req.motoristaId ? { 'dados.motoristaId': req.motoristaId } : {}),
});

async function veiculosVinculados(req) {
  if (!req.motoristaId) return null;
  const agora = new Date().toISOString();
  const vinculos = await Registro.find({
    clienteId: req.user.clienteId, tipo: 'vinculos', 'dados.motoristaId': req.motoristaId,
    'dados.inicio': { $lte: agora },
    $or: [{ 'dados.fim': { $exists: false } }, { 'dados.fim': { $gt: agora } }],
  }).select('dados.veiculoId').lean();
  return vinculos.map(v => v.dados.veiculoId);
}

router.get('/opcoes', tratar(async (req, res) => {
  const vinculados = await veiculosVinculados(req);
  const atribuidos = req.motoristaId
    ? await Registro.distinct('dados.veiculoId', escopo(req))
    : null;
  const veiculos = await Veiculo.find({
    clienteId: req.user.clienteId,
    ...(vinculados ? { _id: { $in: [...new Set([...vinculados, ...atribuidos].filter(id))] } } : {}),
  }).select('_id placa marca modelo').sort({ placa: 1 }).limit(1000).lean();
  const motoristas = req.motoristaId ? [] : await Motorista.find({
    clienteId: req.user.clienteId, status: 'ativo',
  }).select('nome').sort({ nome: 1 }).limit(1000).lean();
  return res.json({
    sucesso: true, veiculos, motoristas, vinculados,
    geocodificador: Boolean(process.env.TMS_GEOCODIFICADOR_URL?.trim()),
    roteador: Boolean(process.env.TMS_OSRM_URL?.trim()),
  });
}));

router.get('/paradas', tratar(async (req, res) => {
  const { veiculoId, codigo, situacao } = req.query;
  if (!id(veiculoId) || (situacao !== undefined && situacao !== 'historico') ||
      (codigo !== undefined && (typeof codigo !== 'string' || !codigo.trim() || codigo.length > 100))) {
    falha(400, 'Informe o veículo e um código válido.');
  }
  const filtro = { ...escopo(req), 'dados.veiculoId': veiculoId };
  if (codigo) filtro.$or = [{ 'dados.codigo': codigo }, { 'dados.chaveNfe': codigo }];
  else filtro['dados.status'] = { $in: situacao === 'historico' ? encerradas : pendentes };
  const dados = await Registro.find(filtro).sort({ createdAt: -1, _id: -1 }).limit(201).lean();
  res.set('Cache-Control', 'no-store');
  return res.json({ sucesso: true, dados: dados.slice(0, 200), limitado: dados.length > 200 });
}));

router.post('/paradas', tratar(async (req, res) => {
  const b = req.body || {};
  const { erros, dados } = validar('cargas', {
    ...b, codigo: b.chaveNfe || b.codigo, motoristaId: req.motoristaId || b.motoristaId,
    status: 'pendente',
  });
  if (erros.length) falha(400, erros.join(' '));
  const vinculados = await veiculosVinculados(req);
  if (vinculados && !vinculados.includes(dados.veiculoId)) falha(403, 'O gestor precisa vincular este veículo ao seu cadastro de motorista.');
  const clienteId = req.user.clienteId;
  if (!(await Veiculo.exists({ _id: dados.veiculoId, clienteId }))) falha(404, 'Veículo não encontrado.');
  if (dados.motoristaId && !(await Motorista.exists({ _id: dados.motoristaId, clienteId, status: 'ativo' }))) {
    falha(404, 'Motorista ativo não encontrado.');
  }
  await Registro.init();
  const documento = await Registro.create({ clienteId, tipo: 'cargas', dados, criadoPor: req.user.email });
  return res.status(201).json({ sucesso: true, dados: documento });
}));

router.get('/conteineres', tratar(async (req, res) => {
  const { veiculoId } = req.query;
  if (!id(veiculoId)) falha(400, 'Informe o veículo.');
  const filtro = { ...escopo(req), clienteId: new mongoose.Types.ObjectId(req.user.clienteId),
    'dados.veiculoId': veiculoId, 'dados.viagemConteinerId': { $type: 'string' } };
  const dados = await Registro.aggregate([
    { $match: filtro },
    { $sort: { 'dados.ordemConteiner': 1 } },
    { $group: { _id: '$dados.viagemConteinerId', criadoEm: { $max: '$createdAt' },
      numero: { $first: '$dados.referenciaCarga' }, modo: { $first: '$dados.modoConteiner' },
      capacidade: { $first: '$dados.capacidadeConteineres' }, inicial: { $first: '$dados.cargaInicial' },
      etapas: { $push: {
        tipo: '$dados.etapaConteiner', ordem: '$dados.ordemConteiner', local: '$dados.destinatario',
        status: '$dados.status', concluidaEm: '$dados.concluidaEm',
        movimentos: '$dados.movimentosConteiner', cargaAposEtapa: '$dados.cargaAposEtapa',
        movimentosRealizados: '$dados.movimentosRealizados', cargaRealAposEtapa: '$dados.cargaRealAposEtapa',
      } } } },
    { $sort: { criadoEm: -1, _id: -1 } },
    { $limit: 21 },
  ]);
  res.set('Cache-Control', 'no-store');
  return res.json({ sucesso: true, dados: dados.slice(0, 20), limitado: dados.length > 20 });
}));
router.post('/conteineres', authorize('admin', 'gestor'), tratar(async (req, res) => {
  const { viagemId, veiculoId, motoristaId, numero, etapas, modo = 'simples', capacidade, cargaInicial } = req.body || {};
  const troca = modo === 'trocas';
  if (typeof viagemId !== 'string' || !/^[a-f\d]{32}$/.test(viagemId) || !id(veiculoId) ||
      (motoristaId && !id(motoristaId)) || typeof numero !== 'string' || !numero.trim() || numero.length > 50 ||
      !['simples', 'trocas'].includes(modo) || !Array.isArray(etapas) ||
      (troca ? etapas.length < 1 || etapas.length > 50 : etapas.length !== etapasConteiner.length)) {
    falha(400, 'Informe a referência, o veículo e as paradas da viagem.');
  }
  const referenciaCarga = numero.trim().toUpperCase();
  const simulacao = troca ? simularCarga({ capacidade, cargaInicial, etapas }) : null;
  const dados = etapas.map((etapa, i) => {
    const codigo = 'CT-' + viagemId + '-' + (i + 1);
    const { erros, dados: parada } = validar('cargas', {
      ...etapa, codigo, veiculoId, motoristaId, referenciaCarga, chaveNfe: undefined, status: 'pendente',
    });
    if (erros.length) falha(400, 'Etapa ' + (i + 1) + ': ' + erros.join(' '));
    return {
      ...parada, viagemConteinerId: viagemId, modoConteiner: modo, ordemConteiner: i + 1,
      etapaConteiner: troca ? 'troca' : etapasConteiner[i],
      ...(troca ? {
        capacidadeConteineres: capacidade,
        ...(i === 0 ? { cargaInicial: simulacao.inicial } : {}),
        movimentosConteiner: simulacao.paradas[i].movimentos,
        cargaAposEtapa: simulacao.paradas[i].cargaAposEtapa,
      } : {}),
    };
  });
  const clienteId = req.user.clienteId;
  if (!(await Veiculo.exists({ _id: veiculoId, clienteId }))) falha(404, 'Veículo não encontrado.');
  if (motoristaId && !(await Motorista.exists({ _id: motoristaId, clienteId, status: 'ativo' }))) {
    falha(404, 'Motorista ativo não encontrado.');
  }
  await Registro.init();
  let documentos;
  try {
    documentos = await mongoose.connection.transaction(session => Registro.insertMany(dados.map(parada => ({
      clienteId, tipo: 'cargas', dados: parada, criadoPor: req.user.email,
    })), { session }));
  } catch (e) {
    if (e.code === 11000) falha(409, 'Esta viagem já foi cadastrada. Confira o histórico de viagens do veículo.');
    throw e;
  }
  return res.status(201).json({ sucesso: true, dados: documentos });
}));

router.patch('/paradas/:id/localizacao', tratar(async (req, res) => {
  if (!id(req.params.id) || !pontoValido(req.body)) falha(400, 'Informe coordenadas válidas.');
  const dados = await Registro.findOneAndUpdate({
    ...escopo(req), _id: req.params.id, 'dados.status': { $in: pendentes },
  }, { $set: { 'dados.latitude': req.body.latitude, 'dados.longitude': req.body.longitude } },
  { returnDocument: 'after' });
  if (!dados) falha(404, 'Parada pendente não encontrada.');
  return res.json({ sucesso: true, dados });
}));

router.get('/paradas/:id/foto', tratar(async (req, res) => {
  if (!id(req.params.id)) falha(400, 'Parada inválida.');
  const parada = await Registro.findOne({ ...escopo(req), _id: req.params.id, 'dados.status': 'entregue' })
    .select('fotoEntrega').exec();
  if (!parada?.fotoEntrega?.length) falha(404, 'Foto do comprovante não encontrada.');
  res.set({ 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  return res.type('jpeg').send(parada.fotoEntrega);
}));

function textoCurto(valor, limite, nome) {
  if (valor === undefined) return '';
  if (typeof valor !== 'string' || valor.length > limite) falha(400, `Confira o campo ${nome}.`);
  return valor.trim();
}

function lerFoto(valor) {
  if (valor === undefined) return undefined;
  if (typeof valor !== 'string' || valor.length > 4 * Math.ceil(tamanhoFoto / 3) ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(valor) || valor.length % 4 !== 0) falha(400, 'Envie uma foto JPEG de até 350 KB.');
  const foto = Buffer.from(valor, 'base64');
  if (foto.length < 5 || foto.length > tamanhoFoto || foto.toString('base64') !== valor ||
      foto[0] !== 255 || foto[1] !== 216 || foto[2] !== 255 || foto.at(-2) !== 255 || foto.at(-1) !== 217) {
    falha(400, 'Envie uma foto JPEG de até 350 KB.');
  }
  return foto;
}

router.patch('/paradas/:id/status', (req, res, next) => lerConclusao(req, res, e => {
  if (!e) return next();
  return res.status(e.status === 413 ? 413 : 400).json({ sucesso: false, mensagem: 'Confira os dados e o tamanho do comprovante.' });
}), tratar(async (req, res) => {
  const { status, recebedor, observacao, motivo, tentativaId, foto, movimentos } = req.body || {};
  if (!id(req.params.id) || !['em_rota', 'chegada', 'tentativa', 'entregue'].includes(status)) falha(400, 'Informe uma situação de entrega válida.');
  const estados = status === 'em_rota' ? ['pendente'] : pendentes;
  const filtro = { ...escopo(req), _id: req.params.id };
  const atual = await Registro.findOne(filtro).lean();
  if (!atual) falha(404, 'Parada não encontrada.');
  if (status === 'tentativa' && atual.dados.tentativas?.some(t => t.id === tentativaId)) return res.json({ sucesso: true, dados: atual });
  if (atual.dados.status === status) return res.json({ sucesso: true, dados: atual });
  if (!estados.includes(atual.dados.status)) falha(409, 'Esta parada já foi encerrada.');
  let anterior;
  if (atual.dados.ordemConteiner > 1) {
    anterior = await Registro.findOne({
      ...escopo(req), 'dados.viagemConteinerId': atual.dados.viagemConteinerId,
      'dados.ordemConteiner': atual.dados.ordemConteiner - 1, 'dados.status': 'entregue',
    }).select('dados.cargaRealAposEtapa dados.cargaAposEtapa').lean();
    if (!anterior) falha(409, 'Conclua a etapa anterior da viagem do contêiner primeiro.');
  }
  const agora = new Date();
  const autor = String(req.user.id);
  const mudanca = { 'dados.status': status === 'entregue' ? status : 'em_rota' };
  const atualizacao = { $set: mudanca };
  if (status === 'chegada') {
    if (atual.dados.chegouEm) return res.json({ sucesso: true, dados: atual });
    filtro['dados.chegouEm'] = { $exists: false };
    mudanca['dados.chegouEm'] = agora;
  }
  if (status === 'tentativa') {
    const razao = textoCurto(motivo, 300, 'motivo');
    if (!razao) falha(400, 'Informe o motivo da tentativa sem sucesso.');
    if (typeof tentativaId !== 'string' || !/^[a-f\d]{32}$/.test(tentativaId)) falha(400, 'Identificador da tentativa inválido.');
    filtro['dados.tentativas.id'] = { $ne: tentativaId };
    atualizacao.$push = { 'dados.tentativas': { $each: [{ id: tentativaId, dataHora: agora, motivo: razao, autor }], $slice: -20 } };
  }
  if (status === 'entregue') {
    const imagem = lerFoto(foto);
    mudanca['dados.concluidaEm'] = agora;
    mudanca['dados.comprovante'] = {
      recebedor: textoCurto(recebedor, 120, 'recebedor'), observacao: textoCurto(observacao, 500, 'observação'),
      autor, temFoto: Boolean(imagem),
    };
    if (imagem) mudanca.fotoEntrega = imagem;
    if (atual.dados.modoConteiner === 'trocas') {
      const cargaInicial = anterior
        ? anterior.dados.cargaRealAposEtapa ?? anterior.dados.cargaAposEtapa
        : atual.dados.cargaInicial;
      const realizados = movimentos ?? atual.dados.movimentosConteiner;
      const resultado = simularCarga({ capacidade: atual.dados.capacidadeConteineres,
        cargaInicial, etapas: [{ movimentos: realizados }] }).paradas[0];
      mudanca['dados.movimentosRealizados'] = resultado.movimentos;
      mudanca['dados.cargaRealAposEtapa'] = resultado.cargaAposEtapa;
    }
  }
  const dados = await Registro.findOneAndUpdate({ ...filtro, 'dados.status': { $in: estados } },
    atualizacao, { returnDocument: 'after' }).lean() ||
    (status === 'chegada' ? await Registro.findOne({ ...escopo(req), _id: req.params.id, 'dados.chegouEm': { $exists: true } }).lean()
      : status === 'tentativa' ? await Registro.findOne({ ...escopo(req), _id: req.params.id, 'dados.tentativas.id': tentativaId }).lean()
        : await Registro.findOne({ ...filtro, 'dados.status': status }).lean());
  if (!dados) falha(404, 'Parada não encontrada ou situação indisponível.');
  return res.json({ sucesso: true, dados });
}));

router.post('/localizar', tratar(async (req, res) => {
  const endereco = req.body?.endereco;
  if (typeof endereco !== 'string' || endereco.trim().length < 5 || endereco.length > 300) {
    falha(400, 'Informe o endereço completo para localizar.');
  }
  if (!process.env.TMS_GEOCODIFICADOR_URL?.trim()) falha(503, 'Geocodificador não configurado.');
  return res.json({ sucesso: true, dados: await localizar(endereco.trim()) });
}));

router.post('/rota', tratar(async (req, res) => {
  const { veiculoId, paradas, origem, partida, retornar = false, velocidadeMedia = 35 } = req.body || {};
  if (!id(veiculoId) || !Array.isArray(paradas) || !paradas.length || paradas.length > 50 ||
      !paradas.every(id) || new Set(paradas).size !== paradas.length ||
      !pontoValido(origem) || !horario(partida) || typeof retornar !== 'boolean' ||
      !Number.isFinite(velocidadeMedia) || velocidadeMedia < 5 || velocidadeMedia > 120) {
    falha(400, 'Escolha de 1 a 50 paradas e informe origem, horário e velocidade válidos.');
  }
  const registros = await Registro.find({
    ...escopo(req), _id: { $in: paradas }, 'dados.veiculoId': veiculoId, 'dados.status': { $in: pendentes },
  }).lean();
  if (registros.length !== paradas.length) falha(404, 'Uma ou mais paradas já foram concluídas ou estão indisponíveis.');
  const pontos = registros.map(r => ({ id: String(r._id), ...r.dados }));
  if (pontos.some(p => !pontoValido(p))) falha(422, 'Confirme a localização de todas as paradas selecionadas.');
  const viagens = [...new Set(pontos.map(p => p.viagemConteinerId).filter(Boolean))];
  if (viagens.length > 1 && pontos.some(p => p.modoConteiner === 'trocas')) {
    falha(409, 'Planeje uma viagem de troca por rota para manter o controle dos contêineres a bordo.');
  }
  const etapas = viagens.length ? await Registro.find({
    ...escopo(req), 'dados.viagemConteinerId': { $in: viagens },
  }).select('dados.viagemConteinerId dados.ordemConteiner dados.status').lean() : [];
  const porViagemEOrdem = new Map(etapas.map(e => [e.dados.viagemConteinerId + ':' + e.dados.ordemConteiner, e]));
  const selecionados = new Set(paradas);
  for (const p of pontos) {
    if (!p.viagemConteinerId || p.ordemConteiner <= 1) continue;
    const anterior = porViagemEOrdem.get(p.viagemConteinerId + ':' + (p.ordemConteiner - 1));
    if (anterior?.dados.status === 'entregue') continue;
    if (!anterior || !selecionados.has(String(anterior._id))) {
      falha(409, 'Inclua as etapas anteriores pendentes do contêiner ' + p.referenciaCarga + '.');
    }
    p.precedenteId = String(anterior._id);
  }
  const dados = await planejar({
    paradas: pontos, origem: { latitude: origem.latitude, longitude: origem.longitude },
    partida, retornar, velocidadeMedia,
  });
  return res.json({ sucesso: true, dados });
}));

module.exports = router;
