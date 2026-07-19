const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const usuarioSchema = new mongoose.Schema({
  nome: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  senha: { type: String, required: true },
  role: { type: String, enum: ['admin', 'gestor', 'operador', 'motorista'], default: 'operador' },
  clienteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Cliente', required: true },
  ativo: { type: Boolean, default: true },
  dataCadastro: { type: Date, default: Date.now },
});

usuarioSchema.pre('save', async function (next) {
  if (!this.isModified('senha')) return next();
  const hash = await bcrypt.hash(this.senha, 10);
  this.senha = hash;
  next();
});

usuarioSchema.methods.compararSenha = async function (senha) {
  return bcrypt.compare(senha, this.senha);
};

module.exports = mongoose.model('Usuario', usuarioSchema);
