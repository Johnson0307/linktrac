const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const oid = mongoose.Schema.Types.ObjectId;
const verificacao = new mongoose.Schema({ estado: { type: String, enum: ['pendente','verificado','suspenso'], default: 'pendente' },
  por: oid, em: Date, referencia: String }, { _id: false });
const responsavelSchema = new mongoose.Schema({
  clienteId: { type: oid, required: true }, usuarioId: { type: oid, required: true },
  nome: { type: String, required: true }, nascimento: { type: String, required: true }, contato: { type: String, required: true },
  verificacao: { type: verificacao, default: () => ({}) }, revisaoCadastros: { type: Number, default: 0 },
}, { timestamps: true });
responsavelSchema.index({ clienteId: 1, usuarioId: 1 }, { unique: true });
const ponto = new mongoose.Schema({ latitude: Number, longitude: Number, precisao: Number, velocidade: Number,
  dataHora: Date, recebidoEm: Date, expiraEm: Date }, { _id: false });
const pessoaSchema = new mongoose.Schema({
  clienteId: { type: oid, required: true }, responsavelId: { type: oid, required: true }, usuarioId: { type: oid, required: true },
  nome: { type: String, required: true }, nascimento: { type: String, required: true }, vinculo: { type: String, enum: ['pai','mae','responsavel_legal'], required: true },
  verificacao: { type: verificacao, default: () => ({}) },
  consentimento: { versao: String, hash: String, aceitoEm: Date, por: oid, revogadoEm: Date },
  consentimentoApp: { versao: String, hash: String, aceitoEm: Date, por: oid },
  aparelhoModo: { type: String, enum: ['web','app'], default: 'web' },
  ativo: { type: Boolean, default: true }, geracao: { type: String, default: randomUUID },
  codigoHash: { type: String, select: false }, codigoExpiraEm: Date,
  tokenHash: { type: String, select: false }, tokenExpiraEm: Date,
  aparelhoNome: String, pareadoEm: Date, pausado: { type: Boolean, default: true }, inicioCompartilhamentoEm: Date,
  ultimaRecepcao: Date, ultimaPosicao: ponto, revisaoPosicoes: { type: Number, default: 0 },
}, { timestamps: true });
pessoaSchema.index({ clienteId: 1, usuarioId: 1, createdAt: -1 });
pessoaSchema.index({ codigoHash: 1 }, { unique: true, sparse: true });
pessoaSchema.index({ tokenHash: 1 }, { unique: true, sparse: true });
const posicaoSchema = new mongoose.Schema({
  clienteId: { type: oid, required: true }, usuarioId: { type: oid, required: true }, menorId: { type: oid, required: true },
  geracao: { type: String, required: true }, mensagemId: { type: String, required: true },
  latitude: Number, longitude: Number, precisao: Number, velocidade: Number,
  dataHora: { type: Date, required: true }, recebidoEm: { type: Date, default: Date.now }, expiraEm: { type: Date, required: true },
});
posicaoSchema.index({ menorId: 1, geracao: 1, mensagemId: 1 }, { unique: true });
posicaoSchema.index({ clienteId: 1, usuarioId: 1, menorId: 1, dataHora: -1 });
posicaoSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
const auditoriaSchema = new mongoose.Schema({
  clienteId: oid, usuarioId: oid, menorId: oid, responsavelId: oid, por: oid,
  acao: String, em: { type: Date, default: Date.now }, versao: String, hash: String,
  expiraEm: { type: Date, default: () => new Date(Date.now() + 180 * 86400000) },
});
auditoriaSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
const limiteSchema = new mongoose.Schema({ chave: String, janela: Number, quantidade: Number, expiraEm: Date });
limiteSchema.index({ chave: 1, janela: 1 }, { unique: true });
limiteSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
module.exports = {
  Responsavel: mongoose.model('ResponsavelFamilia', responsavelSchema), Pessoa: mongoose.model('PessoaFamilia', pessoaSchema),
  Posicao: mongoose.model('PosicaoFamilia', posicaoSchema), Auditoria: mongoose.model('AuditoriaFamilia', auditoriaSchema),
  Limite: mongoose.model('LimiteFamilia', limiteSchema),
};
