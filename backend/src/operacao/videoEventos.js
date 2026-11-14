const mongoose = require('mongoose');
const { id, horario } = require('./validacao');
const { tiposCamera } = require('./telemetria');

const tipos = [...tiposCamera, 'sos', 'frenagem', 'manual', 'outro'];
const ObjectId = mongoose.Schema.Types.ObjectId;
const schema = new mongoose.Schema({
  clienteId: { type: ObjectId, required: true },
  veiculoId: { type: ObjectId, required: true },
  dispositivoId: { type: ObjectId, required: true },
  equipamento: { type: String, required: true },
  placa: { type: String, required: true },
  mensagemId: { type: String, required: true },
  dataHora: { type: Date, required: true },
  tipo: { type: String, required: true, enum: tipos },
  canal: { type: Number, required: true },
  clipeUrl: String,
  clipeExpiraEm: Date,
}, { timestamps: true });
schema.index({ clienteId: 1, dispositivoId: 1, mensagemId: 1 }, { unique: true });
schema.index({ clienteId: 1, dataHora: -1, _id: -1 });
schema.index({ clienteId: 1, veiculoId: 1, dataHora: -1, _id: -1 });
const EventoVideo = mongoose.model('EventoVideo', schema);

function urlHttps(valor) {
  if (typeof valor !== 'string' || valor.length > 2048) return null;
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

async function receber(req, res) {
  const { mensagemId, dataHora, tipo, canal = 1, clipeUrl, clipeExpiraEm } = req.body || {};
  const url = clipeUrl === undefined ? undefined : urlHttps(clipeUrl);
  if (typeof mensagemId !== 'string' || !/^[\w.:-]{1,100}$/.test(mensagemId) ||
      !horario(dataHora) || Date.parse(dataHora) > Date.now() + 300000 ||
      !tipos.includes(tipo) || !Number.isInteger(canal) || canal < 1 || canal > 64 ||
      url === null || (clipeExpiraEm !== undefined && (!url || !horario(clipeExpiraEm)))) {
    return res.status(400).json({
      sucesso: false, mensagem: 'Informe identificador, data com fuso, tipo, canal de 1 a 64 e, se houver, URL HTTPS válida do clipe.',
    });
  }
  const chave = {
    clienteId: req.dispositivo.clienteId,
    dispositivoId: req.dispositivo._id,
    mensagemId,
  };
  const evento = {
    veiculoId: req.veiculoIntegracao._id, equipamento: req.dispositivo.nome,
    placa: req.veiculoIntegracao.placa, dataHora: new Date(dataHora), tipo, canal,
  };
  const clipe = url ? { clipeUrl: url, clipeExpiraEm } : {};
  try {
    await EventoVideo.init();
    try {
      const criado = await EventoVideo.create({ ...chave, ...evento, ...clipe });
      return res.status(201).json({ sucesso: true, dados: { id: criado.id } });
    } catch (e) {
      if (e.code !== 11000) throw e;
    }

    // Um clipe pode chegar depois do evento. Reenvios preservam o veículo e os dados originais.
    const filtro = { ...chave, veiculoId: evento.veiculoId, tipo, canal, dataHora: evento.dataHora };
    const existente = url
      ? await EventoVideo.findOneAndUpdate(filtro, {
          $set: clipeExpiraEm === undefined ? { clipeUrl: url } : clipe,
          ...(clipeExpiraEm === undefined ? { $unset: { clipeExpiraEm: 1 } } : {}),
        }, { returnDocument: 'after' })
      : await EventoVideo.findOne(filtro);
    if (!existente) return res.status(409).json({ sucesso: false, mensagem: 'Identificador já usado em outro evento.' });
    return res.json({ sucesso: true, repetido: true, dados: { id: existente.id } });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível registrar o evento de vídeo.' });
  }
}

async function listar(req, res) {
  const { veiculoId, antes, eventoId } = req.query;
  if ((veiculoId && !id(veiculoId)) || (eventoId && !id(eventoId)) ||
      (Boolean(antes) !== Boolean(eventoId)) || (antes && !horario(antes))) {
    return res.status(400).json({ sucesso: false, mensagem: 'Filtro inválido.' });
  }
  try {
    const eventos = await EventoVideo.find({
      clienteId: req.user.clienteId,
      ...(veiculoId ? { veiculoId } : {}),
      ...(antes ? { $or: [{ dataHora: { $lt: antes } }, { dataHora: antes, _id: { $lt: eventoId } }] } : {}),
    }).sort({ dataHora: -1, _id: -1 }).limit(51).lean();
    const dados = eventos.slice(0, 50);
    const ultimo = dados.at(-1);
    res.set('Cache-Control', 'no-store');
    return res.json({
      sucesso: true, dados,
      proximo: eventos.length > 50 ? { antes: ultimo.dataHora, eventoId: ultimo._id } : null,
    });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível consultar os eventos de vídeo.' });
  }
}

module.exports = { receber, listar, tipos };
