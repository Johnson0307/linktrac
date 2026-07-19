const mongoose = require('mongoose');

const veiculoSchema = new mongoose.Schema({
  placa: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
  },
  clienteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Cliente',
    required: true,
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

veiculoSchema.index({ clienteId: 1, placa: 1 }, { unique: true });

module.exports = mongoose.model('Veiculo', veiculoSchema);
