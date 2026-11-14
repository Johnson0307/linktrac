const mongoose = require('mongoose');
const { iconeMapaSchema } = require('../services/iconesMapa');

const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nome: { type: String, required: true, trim: true, maxlength: 100 },
  latitude: { type: Number, required: true, min: -90, max: 90 },
  longitude: { type: Number, required: true, min: -180, max: 180 },
  iconeMapa: { type: iconeMapaSchema, required: true },
}, { timestamps: true });
schema.index({ clienteId: 1, nome: 1, _id: 1 });

module.exports = mongoose.model('ReferenciaMapa', schema);
