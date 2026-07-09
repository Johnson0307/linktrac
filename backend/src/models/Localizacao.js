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
  velocidade: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['Parado', 'Em movimento', 'Sem sinal'],
    default: 'Parado',
  },
  dataHora: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Localizacao', localizacaoSchema);
