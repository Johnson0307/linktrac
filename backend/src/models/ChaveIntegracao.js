const mongoose = require('mongoose');

const permissoesIntegracao = {
  'veiculos:ler': { nome: 'Listar veículos', modulo: 'veiculos' },
  'posicoes:ler': { nome: 'Consultar última posição e histórico', modulo: 'rastreamento' },
  'veiculos:editar': { nome: 'Atualizar marca, modelo, ano e cor', modulo: 'veiculos', alterar: true },
};

const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  nome: { type: String, required: true, trim: true, maxlength: 100 },
  hash: { type: String, required: true, select: false },
  permissoes: { type: [{ type: String, enum: Object.keys(permissoesIntegracao) }], required: true },
  revogadaEm: Date,
}, { timestamps: true });
schema.index({ clienteId: 1, _id: -1 });

module.exports = {
  ChaveIntegracao: mongoose.model('ChaveIntegracao', schema),
  permissoesIntegracao,
};
