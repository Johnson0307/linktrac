const mongoose = require('mongoose');
const { randomUUID } = require('node:crypto');
const Motorista = require('../models/Motorista');
const { Notificacao } = require('../operacao/modelos');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const Configuracao = mongoose.model('ConfiguracaoLembretePonto', new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId, ativo: { type: Boolean, default: false }, atualizadoPor: String,
}, { timestamps: true }));
const estadoSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  veiculoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dataHora: Date, ignicao: Boolean, motoristaId: mongoose.Schema.Types.ObjectId,
  ciclo: String,
}, { timestamps: true });
estadoSchema.index({ clienteId: 1, veiculoId: 1 }, { unique: true });
const Estado = mongoose.model('EstadoLembretePonto', estadoSchema);

// Somente uma leitura recente, real e autenticada pode alterar o ciclo.
function leituraValida(veiculo, leitura, agora = Date.now()) {
  const horario = +new Date(leitura.dataHora);
  return veiculo.ativo !== false && leitura.fonte === 'dispositivo' && Boolean(leitura.dispositivoId) &&
    typeof leitura.ignicao === 'boolean' && Number.isFinite(horario) &&
    horario >= agora - 300000 && horario <= agora + 30000;
}
function transicao(anterior, leitura, motoristaId) {
  if (anterior && +new Date(anterior.dataHora) >= +new Date(leitura.dataHora)) return null;
  const ligada = leitura.ignicao === true;
  const identificador = leitura.telemetria?.identificadorMotorista;
  const identificado = typeof identificador === 'string' && identificador.trim().length > 0;
  const ciclo = ligada && anterior?.ignicao === true ? anterior.ciclo : randomUUID();
  const motorista = ligada ? identificado ? motoristaId || null : anterior?.ignicao === true ? anterior.motoristaId : null : null;
  return {
    estado: { dataHora: new Date(leitura.dataHora), ignicao: ligada, ciclo, motoristaId: motorista },
    avisar: Boolean(ligada && identificado && motoristaId &&
      (anterior?.ignicao !== true || String(anterior.motoristaId) !== String(motoristaId))),
  };
}
async function obterConfiguracao(empresa) {
  return { ativo: Boolean((await Configuracao.findById(empresa).lean())?.ativo), canal: 'web_aberta' };
}
async function salvarConfiguracao(empresa, autor, body) {
  if (!body || typeof body.ativo !== 'boolean') throw erro(400, 'Informe se o lembrete está ativado.');
  await Configuracao.updateOne({ _id: empresa }, { $set: { ativo: body.ativo, atualizadoPor: autor } }, { upsert: true });
  return obterConfiguracao(empresa);
}
async function processar(veiculo, leitura) {
  if (!leituraValida(veiculo, leitura) || !(await obterConfiguracao(veiculo.clienteId)).ativo) return;
  const identificador = leitura.telemetria?.identificadorMotorista;
  // Não utiliza motoristaId do vínculo administrativo como prova de identificação.
  const motorista = typeof identificador === 'string' && identificador.trim() && identificador.length <= 80
    ? await Motorista.findOne({ clienteId: veiculo.clienteId, identificador, status: 'ativo' }).select('_id').lean() : null;
  await Estado.init(); await Notificacao.init();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const filtro = { clienteId: veiculo.clienteId, veiculoId: veiculo._id };
      const anterior = await Estado.findOne(filtro).session(session).lean();
      const proximo = transicao(anterior, leitura, motorista?._id);
      if (!proximo) return;
      await Estado.updateOne(filtro, { $set: proximo.estado }, { upsert: true, session });
      if (proximo.avisar) await Notificacao.updateOne({ clienteId: veiculo.clienteId,
        chave: `lembrete-ponto:${veiculo._id}:${proximo.estado.ciclo}:${motorista._id}:${+new Date(leitura.dataHora)}` }, {
        $setOnInsert: { veiculoId: veiculo._id, motoristaId: motorista._id, tipo: 'lembrete_ponto',
          ocorridoEm: new Date(leitura.dataHora), simulado: false, cicloPonto: proximo.estado.ciclo,
          mensagem: `Motorista identificado no veículo ${veiculo.placa}. Confira seu ponto com o veículo parado. Se ainda não registrou a entrada, abra seu sistema de ponto.`,
        },
      }, { upsert: true, session });
    });
  } finally { await session.endSession(); }
}
async function motoristaDaConta(user) {
  if (user.role !== 'motorista' || typeof user.email !== 'string' || !user.email.trim()) throw erro(403, 'Este lembrete é pessoal do motorista.');
  const motoristas = await Motorista.find({ clienteId: user.clienteId, email: user.email, status: 'ativo' }).select('_id').limit(2).lean();
  if (motoristas.length !== 1) throw erro(403, 'O gestor precisa conferir o cadastro ativo de motorista com o mesmo e-mail da sua conta.');
  return motoristas[0]._id;
}
async function meusLembretes(user) {
  const motoristaId = await motoristaDaConta(user);
  if (!(await obterConfiguracao(user.clienteId)).ativo) return [];
  const estados = await Estado.find({ clienteId: user.clienteId, motoristaId, ignicao: true,
    dataHora: { $gte: new Date(Date.now() - 300000) } }).select('veiculoId ciclo').limit(20).lean();
  if (!estados.length) return [];
  const avisos = await Notificacao.find({ clienteId: user.clienteId, motoristaId, tipo: 'lembrete_ponto', lida: false,
    $or: estados.map(e => ({ veiculoId: e.veiculoId, cicloPonto: e.ciclo })), ocorridoEm: { $gte: new Date(Date.now() - 3600000) },
  }).select('_id mensagem ocorridoEm').sort({ ocorridoEm: -1 }).limit(1).lean();
  const conta = await require('./solidesPonto').Conta.findById(user.clienteId).select('provedor').lean();
  return avisos.map(aviso => ({ ...aviso, pontoUrl: conta?.provedor === 'solides' ? 'https://app.tangerino.com.br/Tangerino/' : null }));
}
async function dispensar(user, id) {
  if (!mongoose.isObjectIdOrHexString(id)) throw erro(400, 'Lembrete inválido.');
  const motoristaId = await motoristaDaConta(user);
  const salvo = await Notificacao.updateOne({ _id: id, clienteId: user.clienteId, motoristaId, tipo: 'lembrete_ponto' }, { $set: { lida: true } });
  if (!salvo.matchedCount) throw erro(404, 'Lembrete indisponível.');
  return { dispensado: true, pontoRegistrado: false };
}
module.exports = { Configuracao, Estado, leituraValida, transicao, processar, obterConfiguracao, salvarConfiguracao, motoristaDaConta, meusLembretes, dispensar };
