const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  usuario: { type: String, required: true, maxlength: 200 },
  metodo: String,
  recurso: String,
  status: Number,
  dataHora: { type: Date, default: Date.now },
});
schema.index({ clienteId: 1, dataHora: -1 });
module.exports = mongoose.model('AcaoUsuario', schema);
