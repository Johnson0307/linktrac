const mongoose = require('mongoose');

const estados = ['para_revisao', 'aprovada', 'em_execucao', 'concluida', 'descartada'];
const itemSchema = new mongoose.Schema({
  id: String, texto: String, categoria: String, status: { type: String, enum: estados },
  revisadoPor: String, revisadoEm: Date,
}, { _id: false });
const schema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  data: String, hash: String, itens: [itemSchema], recebidoPor: String,
}, { timestamps: true });
schema.index({ clienteId: 1, hash: 1 }, { unique: true });
schema.index({ clienteId: 1, data: -1, _id: -1 });
const Edicao = mongoose.model('BriefingEdicao', schema);

async function registrarEdicoes(clienteId, edicoes, recebidoPor) {
  await Edicao.init();
  let novas = 0;
  for (const edicao of edicoes) {
    const filtro = { clienteId, hash: edicao.hash };
    try {
      const resultado = await Edicao.updateOne(filtro, {
        $setOnInsert: { ...edicao, clienteId, recebidoPor: recebidoPor },
      }, { upsert: true, timestamps: { updatedAt: false } });
      novas += resultado.upsertedCount;
    } catch (e) {
      if (e.code !== 11000) throw e;
    }
  }
  return novas;
}

module.exports = { Edicao, estados, registrarEdicoes };
