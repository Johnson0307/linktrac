const mongoose = require('mongoose');

const veiculoSchema = new mongoose.Schema({
  placa: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  ano: { type: Number, required: true },
  cor: { type: String },
  nomeCliente: { type: String, required: true },
  telefone: { type: String },
  ativo: { type: Boolean, default: true },
  dataCadastro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Veiculo', veiculoSchema);
