const mongoose = require('mongoose');
const { iconeMapaSchema } = require('../services/iconesMapa');

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
  clientesEspelhados: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Cliente' }],
  marca: { type: String, required: true },
  modelo: { type: String, required: true },
  ano: { type: Number, required: true },
  cor: { type: String },
  iconeMapa: { type: iconeMapaSchema, default: undefined },
  nomeCliente: { type: String, required: true },
  telefone: { type: String },
  alertaAlimentacaoWhatsApp: { type: Boolean, default: false },
  ativo: { type: Boolean, default: true },
  dataCadastro: { type: Date, default: Date.now },
});

veiculoSchema.index({ clienteId: 1, placa: 1 }, { unique: true });
veiculoSchema.index({ clientesEspelhados: 1 });

module.exports = mongoose.model('Veiculo', veiculoSchema);
