const mongoose = require('mongoose');

const ponto = new mongoose.Schema({
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
}, { _id: false });

const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Veiculo' },
  motoristaId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: 'Motorista' },
  chave: { type: String, required: true },
  titulo: { type: String, required: true, trim: true, maxlength: 80 },
  origem: { type: ponto, required: true },
  destino: { type: ponto, required: true },
  passagens: { type: [ponto], default: undefined },
  porRuas: { type: Boolean, required: true },
  provedor: { type: String, enum: ['osrm', 'tomtom'] },
  distanciaKm: { type: Number, required: true },
  duracaoSegundos: Number,
  geometria: { type: [[Number]], default: undefined, select: false },
  canceladaEm: Date,
}, { timestamps: true });
schema.index({ clienteId: 1, chave: 1 }, { unique: true });
schema.index({ clienteId: 1, createdAt: -1 });
schema.index({ clienteId: 1, motoristaId: 1, createdAt: -1 });

module.exports = mongoose.model('RotaMapa', schema);
