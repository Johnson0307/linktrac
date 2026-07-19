const mongoose = require('mongoose');

const clienteSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  cnpj: { type: String, trim: true },
  ativo: { type: Boolean, default: true },
  dataCadastro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Cliente', clienteSchema);
