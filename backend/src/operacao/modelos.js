const mongoose = require('mongoose');
const { catalogo } = require('./catalogo');
const schema = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, tipo: { type: String, enum: Object.keys(catalogo), required: true }, dados: { type: mongoose.Schema.Types.Mixed, required: true }, criadoPor: String,
  fotoEntrega: { type: Buffer, select: false },
}, { timestamps: true });
schema.index({ clienteId: 1, tipo: 1, createdAt: -1 });
schema.index({ clienteId: 1, tipo: 1, 'dados.codigo': 1 }, { unique: true, partialFilterExpression: { 'dados.codigo': { $type: 'string' } } });
const Registro = mongoose.model('RegistroOperacional', schema);
const notificacao = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, chave: { type: String, required: true }, veiculoId: mongoose.Schema.Types.ObjectId, motoristaId: mongoose.Schema.Types.ObjectId, tipo: String, mensagem: String, simulado: Boolean, lida: { type: Boolean, default: false } }, { timestamps: true });
notificacao.add({ entregasExternas: mongoose.Schema.Types.Mixed, ocorridoEm: Date });
notificacao.index({ clienteId: 1, chave: 1 }, { unique: true });
notificacao.index({ clienteId: 1, createdAt: -1 });
const Notificacao = mongoose.model('NotificacaoOperacional', notificacao);
const dispositivo = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true }, nome: { type: String, required: true }, fabricante: String, modelo: String, codigoExterno: String, protocolo: { type: String, default: 'json-linktrac-v1' }, tokenHash: { type: String, required: true, select: false }, ativo: { type: Boolean, default: true }, ultimaRecepcao: Date }, { timestamps: true });
dispositivo.index({ clienteId: 1, veiculoId: 1 });
dispositivo.add({
  ultimoGpsEm: Date,
  estadoAlimentacao: { type: new mongoose.Schema({ alimentada: Boolean, dataHora: Date }, { _id: false }), select: false },
  ultimaLeitura: { dataHora: Date, ignicao: Boolean, alimentacaoExterna: Boolean, tensaoBateria: Number },
  lacunasRecepcao: { type: [{ _id: false, ultimaRecepcao: Date, retomadaEm: Date }], default: undefined },
});
dispositivo.index({ clienteId: 1, codigoExterno: 1 }, { unique: true, partialFilterExpression: { codigoExterno: { $gt: '' } } });
const Dispositivo = mongoose.model('DispositivoIntegracao', dispositivo);
const estado = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, pneuId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }, veiculoId: { type: mongoose.Schema.Types.ObjectId, default: null }, posicao: String, odometroMontagem: Number, kmAcumulados: { type: Number, default: 0 }, recapagens: { type: Number, default: 0 }, sulcoMm: Number, ultimaData: Date });
estado.index({ clienteId: 1, veiculoId: 1, posicao: 1 }, { unique: true, partialFilterExpression: { veiculoId: { $type: 'objectId' } } });
const EstadoPneu = mongoose.model('EstadoPneu', estado);
const amostra = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true }, motoristaId: mongoose.Schema.Types.ObjectId, mensagemId: { type: String, required: true }, dataHora: { type: Date, required: true }, recebidoEm: { type: Date, default: Date.now }, fonte: String, velocidade: Number, ignicao: { type: Boolean, default: null }, telemetria: { type: mongoose.Schema.Types.Mixed, required: true } });
amostra.index({ veiculoId: 1, mensagemId: 1 }, { unique: true });
amostra.index({ veiculoId: 1, dataHora: -1 });
const Amostra = mongoose.model('AmostraTelemetria', amostra);
const Gateway = mongoose.model('GatewayIntegracao', new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, required: true }, nome: { type: String, required: true }, tokenHash: { type: String, required: true, select: false }, ativo: { type: Boolean, default: true } }, { timestamps: true }));
module.exports = { Registro, Notificacao, Dispositivo, EstadoPneu, Amostra, Gateway };
