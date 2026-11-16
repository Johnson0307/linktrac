const mongoose = require('mongoose');

const localizacaoSchema = new mongoose.Schema({
  veiculoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Veiculo',
    required: true,
  },
  latitude: { type: Number, required: true },
  longitude: { type: Number, required: true },
  endereco: { type: String },
  recebidoEm: { type: Date, default: Date.now },
  mensagemId: { type: String, maxlength: 100 },
  dispositivoId: { type: mongoose.Schema.Types.ObjectId, select: false },
  motoristaId: mongoose.Schema.Types.ObjectId,
  telemetria: { type: mongoose.Schema.Types.Mixed },
  ignicao: { type: Boolean, default: null },
  fonte: { type: String, enum: ['dispositivo', 'simulado'], default: 'dispositivo' },
  velocidade: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Parado', 'Em movimento', 'Sem sinal'],
    default: 'Parado',
  },
  dataHora: { type: Date, default: Date.now },
});

localizacaoSchema.index({ veiculoId: 1, dataHora: -1 });
localizacaoSchema.index({ veiculoId: 1, dispositivoId: 1, dataHora: -1, _id: -1 },
  { partialFilterExpression: { dispositivoId: { $exists: true } } });
localizacaoSchema.index({ veiculoId: 1, mensagemId: 1 }, { unique: true, partialFilterExpression: { mensagemId: { $type: 'string' } } });

module.exports = mongoose.model('Localizacao', localizacaoSchema);
