const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true },
  habilitada: { type: Boolean, default: false },
  nome: { type: String, required: true, trim: true, maxlength: 80 },
  logo: { type: String, default: null },
}, { timestamps: true });

module.exports = mongoose.model('MarcaPortal', schema);
