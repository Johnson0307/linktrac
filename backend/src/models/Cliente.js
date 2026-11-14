const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  cnpj: { type: String, trim: true },
  ativo: { type: Boolean, default: true },
  acessos: mongoose.Schema.Types.Mixed,
  tipo: { type: String, enum: ['cliente', 'revendedora'], default: 'cliente' },
  revendedoraId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', index: true, immutable: true },
  dataCadastro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Cliente', clienteSchema);
