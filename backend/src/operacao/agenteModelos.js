const mongoose = require('mongoose');
const comum = {
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true },
};
const Config = mongoose.model(
  'ConfigAssistenteManutencao',
  new mongoose.Schema(
    {
      ...comum,
      temperaturaMotorMax: Number,
      tensaoMinima: Number,
      dpfObservarPct: Number,
      dpfInspecaoPct: Number,
      monitorar: { type: Boolean, default: false },
    },
    { timestamps: true }
  ).index({ clienteId: 1, veiculoId: 1 }, { unique: true })
);
const Analise = mongoose.model(
  'AnaliseAssistenteManutencao',
  new mongoose.Schema(
    {
      ...comum,
      resultado: { type: mongoose.Schema.Types.Mixed, required: true },
      solicitadoPor: String,
    },
    { timestamps: true }
  ).index({ clienteId: 1, veiculoId: 1, createdAt: -1 })
);
const solicitacaoSchema = new mongoose.Schema(
  {
    ...comum,
    analiseId: { type: mongoose.Schema.Types.ObjectId, required: true },
    codigo: String,
    titulo: String,
    evidencias: mongoose.Schema.Types.Mixed,
    recomendacao: String,
    simulado: Boolean,
    status: {
      type: String,
      enum: ['pendente', 'aprovada', 'concluida', 'descartada'],
      default: 'pendente',
    },
    aberta: { type: Boolean, default: true },
    criadoPor: String,
    decididoPor: String,
    parecer: String,
    historico: [{ status: String, parecer: String, usuario: String, dataHora: Date }],
  },
  { timestamps: true }
);
solicitacaoSchema.index(
  { clienteId: 1, veiculoId: 1, codigo: 1 },
  { unique: true, partialFilterExpression: { aberta: true } }
);
const Solicitacao = mongoose.model('SolicitacaoInspecao', solicitacaoSchema);
module.exports = { Config, Analise, Solicitacao };
