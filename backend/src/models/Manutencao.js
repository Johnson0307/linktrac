const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  servico: { type: String, required: true, maxlength: 200 },
  dataServico: { type: Date, required: true },
  custoCentavos: { type: Number, required: true, min: 0 },
  quilometragem: { type: Number, required: true, min: 0 },
  proximaData: Date,
  proximaQuilometragem: Number,
  criadoEm: { type: Date, default: Date.now },
});
schema.index({ clienteId: 1, veiculoId: 1, dataServico: -1 });
module.exports = mongoose.model('Manutencao', schema);
