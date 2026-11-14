const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nome: { type: String, required: true, trim: true, maxlength: 120 },
  cpf: { type: String, required: true, match: /^\d{11}$/ },
  cnh: { type: String, required: true, match: /^\d{11}$/ },
  validadeCnh: { type: String, required: true },
  categoriaCnh: { type: String, required: true, enum: ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'] },
  telefone: { type: String, maxlength: 30, default: '' },
  email: { type: String, maxlength: 200, default: '' },
  endereco: { type: String, maxlength: 300, default: '' },
  status: { type: String, enum: ['ativo', 'inativo', 'ferias'], default: 'ativo' },
  observacoes: { type: String, maxlength: 1000, default: '' },
  identificador: { type: String, maxlength: 80, default: '' },
}, { timestamps: true });
schema.index({ clienteId: 1, cpf: 1 }, { unique: true });
schema.index({ clienteId: 1, cnh: 1 }, { unique: true });
schema.index({ clienteId: 1, status: 1, nome: 1 });
schema.index({ clienteId: 1, identificador: 1 }, { unique: true, partialFilterExpression: { identificador: { $gt: '' } } });
module.exports = mongoose.model('Motorista', schema);
