const express = require('express');
const mongoose = require('mongoose');
const { id, horario } = require('./validacao');
const { Dispositivo } = require('./modelos');
const catalogo = require('./tagsBleCatalogo.json');

const estados = ['a_testar', 'em_teste', 'homologada', 'incompativel'];
const formatos = ['mac', 'ibeacon', 'eddystone'];
const falhar = (mensagem, status = 400) => { throw Object.assign(new Error(mensagem), { status }); };

function chaveTag(formato, valor) {
  if (typeof valor !== 'string' || valor.length > 100) falhar('Confira o identificador da tag.');
  let codigo;
  if (formato === 'mac') {
    codigo = valor.replace(/[:-]/g, '').toUpperCase();
    if (!/^[A-F0-9]{12}$/.test(codigo)) falhar('Informe o MAC com 12 dígitos hexadecimais.');
  } else if (formato === 'ibeacon') {
    const partes = valor.split(':');
    const uuid = partes[0].replace(/-/g, '').toLowerCase();
    if (partes.length !== 3 || !/^[a-f0-9]{32}$/.test(uuid) ||
        partes.slice(1).some(p => !/^\d{1,5}$/.test(p) || Number(p) > 65535)) {
      falhar('Use UUID:major:minor para identificar uma tag iBeacon.');
    }
    codigo = uuid + ':' + Number(partes[1]) + ':' + Number(partes[2]);
  } else if (formato === 'eddystone') {
    codigo = valor.replace(/[:-]/g, '').toLowerCase();
    if (!/^[a-f0-9]{32}$/.test(codigo)) falhar('Informe Namespace e Instance com 32 dígitos hexadecimais.');
  } else falhar('Selecione MAC, iBeacon ou Eddystone.');
  return { formato, identificador: codigo, chave: formato + ':' + codigo };
}

const deteccaoSchema = new mongoose.Schema({
  dataHora: Date, recebidoEm: Date, receptorId: mongoose.Schema.Types.ObjectId,
  mensagemId: String, rssi: Number, bateriaV: Number, bateriaBaixa: Boolean,
  temperaturaC: Number, latitude: Number, longitude: Number,
}, { _id: false });
const tagSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nome: { type: String, required: true }, fabricante: String, modelo: String,
  bem: { type: String, required: true }, formato: { type: String, enum: formatos, required: true },
  identificador: { type: String, required: true }, chave: { type: String, required: true },
  receptorId: mongoose.Schema.Types.ObjectId, firmwareTag: String, firmwareReceptor: String,
  status: { type: String, enum: estados, default: 'a_testar' },
  observacao: String, ativo: { type: Boolean, default: true },
  vinculadaEm: { type: Date, default: Date.now }, ultimaDeteccao: deteccaoSchema,
}, { timestamps: true, optimisticConcurrency: true });
tagSchema.index({ clienteId: 1, chave: 1 }, { unique: true });
tagSchema.index({ clienteId: 1, ativo: 1, updatedAt: -1 });
const TagBle = mongoose.model('TagBle', tagSchema);
const historicoSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tagId: { type: mongoose.Schema.Types.ObjectId, required: true }, por: String,
  tipo: String, anterior: mongoose.Schema.Types.Mixed, cadastro: mongoose.Schema.Types.Mixed,
}, { timestamps: true });
historicoSchema.index({ clienteId: 1, tagId: 1, createdAt: -1, _id: -1 });
const HistoricoTagBle = mongoose.model('HistoricoTagBle', historicoSchema);

function validarCadastro(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) falhar('Confira o cadastro da tag.');
  const dados = chaveTag(body.formato, body.identificador);
  for (const [campo, maximo] of Object.entries({
    nome: 100, bem: 150, fabricante: 100, modelo: 100,
    firmwareTag: 100, firmwareReceptor: 100, observacao: 1000,
  })) {
    const valor = body[campo] ?? '';
    if (typeof valor !== 'string' || valor.length > maximo) falhar('Confira os dados da tag.');
    dados[campo] = valor.trim();
  }
  if (!dados.nome || !dados.bem) falhar('Informe o nome da tag e o bem identificado.');
  if (!estados.includes(body.status)) falhar('Selecione a situação da homologação.');
  if (typeof body.ativo !== 'boolean') falhar('Informe se a tag está ativa.');
  if (body.receptorId && !id(body.receptorId)) falhar('Receptor inválido.');
  return { ...dados, status: body.status, ativo: body.ativo, receptorId: body.receptorId || null };
}

function validarDeteccoes(body) {
  if (!body || !horario(body.dataHora) || Date.parse(body.dataHora) < Date.UTC(2000, 0, 1) ||
      Date.parse(body.dataHora) > Date.now() + 300000 || typeof body.mensagemId !== 'string' ||
      !/^[\w.:-]{1,100}$/.test(body.mensagemId) ||
      !Array.isArray(body.tags) || body.tags.length < 1 || body.tags.length > 100) {
    falhar('Envie dataHora ISO com fuso, mensagemId e de 1 a 100 detecções BLE.');
  }
  const posicao = {};
  if (body.latitude !== undefined || body.longitude !== undefined) {
    if (!Number.isFinite(body.latitude) || Math.abs(body.latitude) > 90 ||
        !Number.isFinite(body.longitude) || Math.abs(body.longitude) > 180) {
      falhar('Informe as duas coordenadas válidas do receptor.');
    }
    posicao.latitude = body.latitude; posicao.longitude = body.longitude;
  }
  const tags = body.tags.map(tag => {
    const dados = chaveTag(tag?.formato, tag?.identificador);
    for (const [campo, [min, max]] of Object.entries({
      rssi: [-127, 20], bateriaV: [0, 6], temperaturaC: [-100, 200],
    })) {
      if (tag[campo] === undefined) continue;
      if (!Number.isFinite(tag[campo]) || tag[campo] < min || tag[campo] > max) falhar('Confira as medições da tag BLE.');
      dados[campo] = tag[campo];
    }
    if (tag.bateriaBaixa !== undefined) {
      if (typeof tag.bateriaBaixa !== 'boolean') falhar('Confira o indicador de bateria baixa.');
      dados.bateriaBaixa = tag.bateriaBaixa;
    }
    return dados;
  });
  if (new Set(tags.map(t => t.chave)).size !== tags.length) falhar('Envie cada identificador uma vez por mensagem.');
  return { dataHora: new Date(body.dataHora), mensagemId: body.mensagemId, tags, posicao };
}

async function receberDeteccoes(dispositivo, body) {
  const dados = validarDeteccoes(body);
  const receptorAtivo = await Dispositivo.exists({
    _id: dispositivo._id, clienteId: dispositivo.clienteId, ativo: true,
  });
  if (!receptorAtivo) falhar('Receptor indisponível.', 404);
  let atualizadas = 0;
  for (const leitura of dados.tags) {
    const { chave, formato, identificador, ...medicoes } = leitura;
    const resultado = await TagBle.updateOne({
      clienteId: dispositivo.clienteId, ativo: true, chave,
      vinculadaEm: { $lte: dados.dataHora },
      $and: [
        { $or: [{ receptorId: null }, { receptorId: dispositivo._id }] },
        { $or: [{ 'ultimaDeteccao.dataHora': { $exists: false } },
          { 'ultimaDeteccao.dataHora': { $lt: dados.dataHora } }] },
      ],
    }, { $set: { ultimaDeteccao: {
      ...medicoes, ...dados.posicao, dataHora: dados.dataHora, recebidoEm: new Date(),
      receptorId: dispositivo._id, mensagemId: dados.mensagemId,
    } } }, { timestamps: false });
    atualizadas += resultado.modifiedCount;
  }
  return { recebidas: dados.tags.length, atualizadas };
}

function extrairTraccar(position) {
  const atributos = position?.attributes || {};
  const tags = [];
  const adicionar = (formato, identificador, medicoes) => {
    try {
      const tag = { ...chaveTag(formato, identificador), ...medicoes };
      if (!tags.some(t => t.chave === tag.chave)) tags.push(tag);
    } catch { /* Um identificador desconhecido não impede receber o GPS. */ }
  };
  for (let i = 1; i <= 32; i++) {
    const medicoesBeacon = {}, medicoesTag = {};
    for (const [prefixo, medicoes] of [['beacon', medicoesBeacon], ['tag', medicoesTag]]) {
      const sinal = atributos[prefixo + i + 'Rssi'];
      if (Number.isFinite(sinal) && sinal >= -127 && sinal <= 20) medicoes.rssi = sinal;
      const bateria = atributos[prefixo + i + 'Battery'];
      const volts = prefixo === 'tag' ? bateria / 1000 : bateria;
      if (Number.isFinite(volts) && volts >= 0 && volts <= 6) medicoes.bateriaV = volts;
    }
    const baixa = atributos['tag' + i + 'LowBattery'];
    if ([true, false, 0, 1].includes(baixa)) medicoesTag.bateriaBaixa = Boolean(baixa);
    const mac = atributos['tag' + i + 'Mac'];
    if (typeof mac === 'string') adicionar('mac', mac, medicoesTag);
    const uuid = atributos['beacon' + i + 'Uuid'];
    if (typeof uuid === 'string') adicionar('ibeacon',
      uuid + ':' + atributos['beacon' + i + 'Major'] + ':' + atributos['beacon' + i + 'Minor'], medicoesBeacon);
    const namespace = atributos['beacon' + i + 'Namespace'];
    const instancia = atributos['beacon' + i + 'Instance'];
    if (typeof namespace === 'string' && typeof instancia === 'string') adicionar('eddystone', namespace + instancia, medicoesBeacon);
    const codigo = atributos['tag' + i + 'Id'];
    if (typeof codigo === 'string' && /^[a-f0-9]{40}$/i.test(codigo)) {
      adicionar('ibeacon', codigo.slice(0, 32) + ':' + parseInt(codigo.slice(32, 36), 16) +
        ':' + parseInt(codigo.slice(36), 16), medicoesTag);
    } else if (typeof codigo === 'string' && /^[a-f0-9]{32}$/i.test(codigo)) {
      adicionar('eddystone', codigo, medicoesTag);
    }
  }
  return tags.map(({ chave, ...t }) => t);
}

async function receberTraccar(dispositivo, position) {
  const tags = extrairTraccar(position);
  if (!tags.length) return;
  const dataHora = position.deviceTime || position.fixTime;
  const posicao = {};
  if (position.valid === true && !position.outdated &&
      Math.abs(Date.parse(position.fixTime) - Date.parse(dataHora)) <= 60000) {
    posicao.latitude = position.latitude; posicao.longitude = position.longitude;
  }
  return receberDeteccoes(dispositivo, {
    dataHora, mensagemId: 'ble:' + position.id + ':' + Date.parse(dataHora), tags, ...posicao,
  });
}

const router = express.Router();
const tratar = acao => async (req, res) => {
  try { await acao(req, res); } catch (erro) {
    res.status(erro.code === 11000 ? 409 : erro.status || 503).json({
      sucesso: false, mensagem: erro.code === 11000 ? 'Esta tag já está cadastrada na empresa.'
        : erro.status ? erro.message : 'Não foi possível concluir a operação das tags BLE.',
    });
  }
};
router.get('/', tratar(async (req, res) => {
  const [dados, receptores] = await Promise.all([
    TagBle.find({ clienteId: req.user.clienteId }).sort({ createdAt: -1 }).limit(501).lean(),
    Dispositivo.find({ clienteId: req.user.clienteId, ativo: true })
      .select('_id nome fabricante modelo').limit(1000).lean(),
  ]);
  res.set('Cache-Control', 'private, no-store');
  res.json({ sucesso: true, dados: dados.slice(0, 500), limitado: dados.length > 500, receptores, catalogo });
}));
router.get('/:id/historico', tratar(async (req, res) => {
  if (!id(req.params.id)) falhar('Tag inválida.');
  const dados = await HistoricoTagBle.find({ clienteId: req.user.clienteId, tagId: req.params.id })
    .sort({ createdAt: -1, _id: -1 }).limit(100).lean();
  res.json({ sucesso: true, dados });
}));
const salvar = editar => tratar(async (req, res) => {
  if (editar && !id(req.params.id)) falhar('Tag inválida.');
  const dados = validarCadastro(req.body);
  if (dados.receptorId && !await Dispositivo.exists({
    _id: dados.receptorId, clienteId: req.user.clienteId, ativo: true,
  })) falhar('Selecione um receptor ativo da sua empresa.', 404);
  await Promise.all([TagBle.init(), HistoricoTagBle.init()]);
  const resultado = await mongoose.connection.transaction(async session => {
    const doc = editar ? await TagBle.findOne({ _id: req.params.id, clienteId: req.user.clienteId })
      .session(session) : new TagBle({ clienteId: req.user.clienteId });
    if (!doc) falhar('Tag não encontrada.', 404);
    const anterior = editar ? doc.toObject() : undefined;
    const novoVinculo = !editar || doc.chave !== dados.chave || String(doc.receptorId || '') !== String(dados.receptorId || '') ||
      doc.bem !== dados.bem || (!doc.ativo && dados.ativo);
    doc.set(dados);
    if (novoVinculo) { doc.vinculadaEm = new Date(); doc.ultimaDeteccao = undefined; }
    await doc.save({ session });
    await HistoricoTagBle.create([{
      clienteId: req.user.clienteId, tagId: doc._id, por: req.user.email || String(req.user.id),
      tipo: editar ? 'edicao' : 'cadastro', anterior,
      cadastro: doc.toObject(),
    }], { session });
    return doc;
  });
  res.status(editar ? 200 : 201).json({ sucesso: true, dados: resultado });
});
router.post('/', salvar(false));
router.put('/:id', salvar(true));

module.exports = { router, TagBle, HistoricoTagBle, chaveTag, validarCadastro, validarDeteccoes,
  receberDeteccoes, extrairTraccar, receberTraccar };
