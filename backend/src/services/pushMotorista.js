const mongoose = require('mongoose');
const { randomBytes, randomUUID, createHash, createCipheriv, createDecipheriv } = require('node:crypto');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const { escopoEmpresa } = require('./carteiraRevenda');
const { permite } = require('./acessosCliente');
const lembrete = require('./lembretePonto');
const { Notificacao } = require('../operacao/modelos');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const hash = valor => createHash('sha256').update(valor).digest('hex');
const uuid = valor => typeof valor === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(valor);
const tokenValido = valor => typeof valor === 'string' && /^(?:Expo|Exponent)PushToken\[[A-Za-z0-9_-]{10,180}\]$/.test(valor);
const aparelhoSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, required: true }, clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  motoristaId: { type: mongoose.Schema.Types.ObjectId, required: true }, instalacao: { type: String, required: true },
  credencialHash: { type: String, required: true, select: false }, geracao: String,
  pushHash: { type: String, select: false }, pushProtegido: { type: String, select: false },
  plataforma: { type: String, enum: ['android', 'ios'] }, ativo: Boolean, pushAtivo: Boolean,
  expiraEm: { type: Date, required: true },
}, { timestamps: true });
aparelhoSchema.index({ usuarioId: 1, instalacao: 1 }, { unique: true });
aparelhoSchema.index({ credencialHash: 1 }, { unique: true });
aparelhoSchema.index({ pushHash: 1 }, { unique: true, partialFilterExpression: { pushHash: { $type: 'string' } } });
aparelhoSchema.index({ clienteId: 1, motoristaId: 1, ativo: 1 });
aparelhoSchema.index({ expiraEm: 1 }, { expireAfterSeconds: 0 });
const Aparelho = mongoose.model('AparelhoMotorista', aparelhoSchema);
const entregaSchema = new mongoose.Schema({
  notificacaoId: mongoose.Schema.Types.ObjectId, aparelhoId: mongoose.Schema.Types.ObjectId, geracao: String,
  estado: { type: String, enum: ['pendente', 'processando', 'recibo', 'aceito_provedor', 'falha', 'expirado'] },
  tentativas: { type: Number, default: 0 }, tentarEm: Date, travaAte: Date, ticket: String, codigo: String,
  expiraAvisoEm: Date, removerEm: Date,
}, { timestamps: true });
entregaSchema.index({ notificacaoId: 1, aparelhoId: 1, geracao: 1 }, { unique: true });
entregaSchema.index({ estado: 1, tentarEm: 1 });
entregaSchema.index({ removerEm: 1 }, { expireAfterSeconds: 0 });
const Entrega = mongoose.model('EntregaPushMotorista', entregaSchema);
function chave() {
  const valor = process.env.INTEGRACOES_CHAVE_CRIPTOGRAFIA || process.env.FINANCEIRO_CHAVE_CRIPTOGRAFIA;
  if (!/^[a-f0-9]{64}$/i.test(valor || '')) throw erro(503, 'A proteção do aplicativo precisa ser configurada no servidor.');
  return Buffer.from(valor, 'hex');
}
function proteger(token, contexto) {
  const iv = randomBytes(12), cifra = createCipheriv('aes-256-gcm', chave(), iv);
  cifra.setAAD(Buffer.from('push-motorista:' + contexto));
  return Buffer.concat([iv, cifra.update(token, 'utf8'), cifra.final(), cifra.getAuthTag()]).toString('base64');
}
function revelar(valor, contexto) {
  const bytes = Buffer.from(valor, 'base64'), cifra = createDecipheriv('aes-256-gcm', chave(), bytes.subarray(0, 12));
  cifra.setAAD(Buffer.from('push-motorista:' + contexto)); cifra.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cifra.update(bytes.subarray(12, -16)), cifra.final()]).toString('utf8');
}
function configuracao() {
  let protegida = false; try { chave(); protegida = true; } catch { /* Configuração ainda pendente. */ }
  const projectId = process.env.PUSH_MOTORISTA_EXPO_PROJECT_ID;
  return { disponivel: process.env.PUSH_MOTORISTA_HABILITADO === '1' && protegida && uuid(projectId) &&
    Boolean(process.env.PUSH_MOTORISTA_EXPO_ACCESS_TOKEN?.trim()), projectId: uuid(projectId) ? projectId : null };
}
async function autorizar(user) {
  const empresa = await Cliente.findById(user.clienteId).select('ativo acessos tipo revendedoraId').lean();
  const escopo = await escopoEmpresa(empresa);
  if (!escopo || !permite(escopo.acessos, 'operacao')) throw erro(403, 'Jornada não está liberada para sua empresa.');
  return lembrete.motoristaDaConta(user);
}
async function registrar(user, body) {
  const motoristaId = await autorizar(user);
  if (!uuid(body?.instalacao) || !['android', 'ios'].includes(body?.plataforma) || typeof body.pushAtivo !== 'boolean') throw erro(400, 'Dados do aplicativo inválidos.');
  const c = configuracao();
  if (body.pushAtivo && (!c.disponivel || body.projectId !== c.projectId)) throw erro(503, 'As credenciais de notificações do aplicativo ainda precisam ser configuradas.');
  if (body.pushAtivo && (!tokenValido(body.pushToken) || body.consentimento !== true)) throw erro(400, 'Autorize as notificações neste celular antes de ativar os avisos.');
  const token = randomBytes(32).toString('hex'), expiraEm = new Date(Date.now() + 30 * 86400000);
  const dados = { clienteId: user.clienteId, motoristaId, plataforma: body.plataforma,
    ativo: true, pushAtivo: body.pushAtivo, credencialHash: hash(token), expiraEm, geracao: randomUUID() };
  if (body.pushAtivo) {
    dados.pushHash = hash(body.pushToken);
    dados.pushProtegido = proteger(body.pushToken, `${user.clienteId}:${user.id}:${body.instalacao}`);
  }
  try {
    await Aparelho.findOneAndUpdate({ usuarioId: user.id, instalacao: body.instalacao }, {
      $set: dados, ...(!body.pushAtivo ? { $unset: { pushHash: '', pushProtegido: '' } } : {}),
    }, { upsert: true, runValidators: true });
  } catch (e) {
    if (e.code === 11000) throw erro(409, 'Este celular ainda está vinculado a outra conta. Saia da conta anterior antes de conectar.');
    throw e;
  }
  return { token, expiraEm, pushAtivo: dados.pushAtivo };
}
async function usuarioDoAparelho(aparelho) {
  const u = await Usuario.findOne({ _id: aparelho.usuarioId, clienteId: aparelho.clienteId, ativo: { $ne: false }, role: 'motorista' }).select('_id email role clienteId nome').lean();
  if (!u) throw erro(401, 'Entre novamente com sua conta de motorista.');
  const user = { id: u._id, ...u };
  if (String(await autorizar(user)) !== String(aparelho.motoristaId)) throw erro(403, 'O vínculo deste aparelho mudou. Entre novamente.');
  return user;
}
async function autenticar(token, somenteDesconectar = false) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw erro(401, 'Acesso do aplicativo inválido.');
  const aparelho = await Aparelho.findOne({ credencialHash: hash(token) }).lean();
  if (!aparelho) throw erro(401, 'Entre novamente no aplicativo.');
  if (somenteDesconectar) return { aparelho };
  if (!aparelho.ativo || +aparelho.expiraEm <= Date.now()) throw erro(401, 'O acesso do aplicativo expirou. Entre novamente.');
  return { aparelho, user: await usuarioDoAparelho(aparelho) };
}
async function desconectar(aparelho) {
  await Aparelho.updateOne({ _id: aparelho._id }, { $set: { ativo: false, pushAtivo: false }, $unset: { pushProtegido: '', pushHash: '' } });
  return { desconectado: true };
}
async function configurarAvisos(aparelho, body) {
  if (typeof body?.ativo !== 'boolean') throw erro(400, 'Informe se deseja receber avisos.');
  if (!body.ativo) {
    await Aparelho.updateOne({ _id: aparelho._id, ativo: true }, { $set: { pushAtivo: false }, $unset: { pushProtegido: '', pushHash: '' } });
    return { pushAtivo: false };
  }
  const c = configuracao();
  if (!c.disponivel || body.projectId !== c.projectId) throw erro(503, 'As credenciais de notificações do aplicativo ainda precisam ser configuradas.');
  if (!tokenValido(body.pushToken) || body.consentimento !== true) throw erro(400, 'Autorize as notificações neste celular.');
  try {
    await Aparelho.updateOne({ _id: aparelho._id, ativo: true }, { $set: { pushAtivo: true,
      pushHash: hash(body.pushToken), pushProtegido: proteger(body.pushToken, `${aparelho.clienteId}:${aparelho.usuarioId}:${aparelho.instalacao}`) } });
  } catch (e) { if (e.code === 11000) throw erro(409, 'Saia da conta anteriormente vinculada a este celular.'); throw e; }
  return { pushAtivo: true };
}
async function status(user, aparelho) {
  return { nome: user.nome, expiraEm: aparelho.expiraEm, pushAtivo: aparelho.pushAtivo,
    pushDisponivel: configuracao().disponivel, projectId: configuracao().projectId, lembrete: await lembrete.obterConfiguracao(user.clienteId) };
}
function mensagemPush(token, segundos = 180) {
  return { to: token, title: 'Linktrac · Confira seu ponto',
    body: 'Abra o Linktrac para conferir a jornada com o veículo parado.',
    sound: 'default', channelId: 'jornada', priority: 'high', ttl: segundos,
    data: { tipo: 'lembrete_ponto' } };
}
async function requisitarExpo(caminho, body, enviar = fetch) {
  if (!['send', 'getReceipts'].includes(caminho)) throw erro(400, 'Operação de notificação inválida.');
  const res = await enviar('https://exp.host/--/api/v2/push/' + caminho, {
    method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json',
      Authorization: 'Bearer ' + process.env.PUSH_MOTORISTA_EXPO_ACCESS_TOKEN }, body: JSON.stringify(body),
  });
  if (!res.ok) throw Object.assign(new Error('Provedor de notificações indisponível.'), { temporario: res.status === 429 || res.status >= 500 });
  return res.json();
}
async function prepararFila() {
  const avisos = await Notificacao.find({ tipo: 'lembrete_ponto', lida: false, pushPreparado: { $ne: true },
    ocorridoEm: { $gte: new Date(Date.now() - 180000) } }).sort({ ocorridoEm: 1 }).limit(300).lean();
  for (const aviso of avisos) {
    const aparelhos = await Aparelho.find({ clienteId: aviso.clienteId, motoristaId: aviso.motoristaId,
      ativo: true, pushAtivo: true, expiraEm: { $gt: new Date() } }).select('_id geracao').limit(10).lean();
    for (const aparelho of aparelhos) await Entrega.updateOne({ notificacaoId: aviso._id, aparelhoId: aparelho._id, geracao: aparelho.geracao }, {
      $setOnInsert: { estado: 'pendente', tentarEm: new Date(), expiraAvisoEm: new Date(+aviso.ocorridoEm + 180000), removerEm: new Date(Date.now() + 2 * 86400000) },
    }, { upsert: true });
    await Notificacao.updateOne({ _id: aviso._id }, { $set: { pushPreparado: true } });
  }
}
async function aindaValido(entrega, aparelho) {
  if (!aparelho?.ativo || !aparelho.pushAtivo || aparelho.geracao !== entrega.geracao || +aparelho.expiraEm <= Date.now()) return false;
  const user = await usuarioDoAparelho(aparelho);
  if (!(await lembrete.obterConfiguracao(user.clienteId)).ativo) return false;
  const aviso = await Notificacao.findOne({ _id: entrega.notificacaoId, clienteId: user.clienteId,
    motoristaId: aparelho.motoristaId, tipo: 'lembrete_ponto', lida: false }).lean();
  return Boolean(aviso && await lembrete.Estado.exists({ clienteId: user.clienteId, veiculoId: aviso.veiculoId,
    motoristaId: aparelho.motoristaId, ciclo: aviso.cicloPonto, ignicao: true, dataHora: { $gte: new Date(Date.now() - 300000) } }));
}
async function falha(entrega, temporario, codigo) {
  const repetir = temporario && entrega.tentativas < 3 && +entrega.expiraAvisoEm > Date.now() + 30000;
  await Entrega.updateOne({ _id: entrega._id }, { $set: { estado: repetir ? 'pendente' : 'falha', codigo,
    tentarEm: new Date(Date.now() + 30000 * Math.max(1, entrega.tentativas)) } });
}
async function enviarFila() {
  await Entrega.updateMany({ estado: 'processando', travaAte: { $lt: new Date() } }, { $set: { estado: 'pendente' } });
  await Entrega.updateMany({ estado: 'pendente', expiraAvisoEm: { $lt: new Date() } }, { $set: { estado: 'expirado' } });
  const lote = [];
  for (let i = 0; i < 50; i++) {
    const entrega = await Entrega.findOneAndUpdate({ estado: 'pendente', tentarEm: { $lte: new Date() }, expiraAvisoEm: { $gt: new Date() } },
      { $set: { estado: 'processando', travaAte: new Date(Date.now() + 60000) }, $inc: { tentativas: 1 } }, { returnDocument: 'after' }).lean();
    if (!entrega) break;
    try {
      const aparelho = await Aparelho.findById(entrega.aparelhoId).select('+pushProtegido').lean();
      if (!await aindaValido(entrega, aparelho)) { await Entrega.updateOne({ _id: entrega._id }, { $set: { estado: 'expirado' } }); continue; }
      const token = revelar(aparelho.pushProtegido, `${aparelho.clienteId}:${aparelho.usuarioId}:${aparelho.instalacao}`);
      lote.push({ entrega, aparelho, mensagem: mensagemPush(token, Math.max(1, Math.floor((+entrega.expiraAvisoEm - Date.now()) / 1000))) });
    } catch (e) { await falha(entrega, !e.status, 'autorizacao_ou_configuracao'); }
  }
  if (!lote.length) return;
  let resposta;
  try { resposta = await requisitarExpo('send', lote.map(e => e.mensagem)); }
  catch (e) { for (const item of lote) await falha(item.entrega, e.temporario !== false, 'envio_indisponivel'); return; }
  for (let i = 0; i < lote.length; i++) {
    const { entrega, aparelho } = lote[i], ticket = resposta?.data?.[i];
    if (ticket?.status === 'ok' && uuid(ticket.id)) await Entrega.updateOne({ _id: entrega._id }, {
      $set: { estado: 'recibo', ticket: ticket.id, tentarEm: new Date(Date.now() + 15 * 60000) },
    });
    else {
      if (ticket?.details?.error === 'DeviceNotRegistered') await Aparelho.updateOne({ _id: aparelho._id, geracao: aparelho.geracao }, { $set: { pushAtivo: false } });
      await falha(entrega, ticket?.details?.error === 'MessageRateExceeded', 'recusado_pelo_provedor');
    }
  }
}
async function conferirRecibos() {
  const entregas = await Entrega.find({ estado: 'recibo', tentarEm: { $lte: new Date() } }).limit(100).lean();
  if (!entregas.length) return;
  let resposta; try { resposta = await requisitarExpo('getReceipts', { ids: entregas.map(e => e.ticket) }); } catch { return; }
  for (const e of entregas) {
    const recibo = resposta?.data?.[e.ticket];
    if (!recibo && Date.now() - +e.createdAt < 86400000) { await Entrega.updateOne({ _id: e._id }, { $set: { tentarEm: new Date(Date.now() + 15 * 60000) } }); continue; }
    if (recibo?.details?.error === 'DeviceNotRegistered') await Aparelho.updateOne({ _id: e.aparelhoId, geracao: e.geracao }, { $set: { pushAtivo: false } });
    await Entrega.updateOne({ _id: e._id }, { $set: { estado: recibo?.status === 'ok' ? 'aceito_provedor' : 'falha', codigo: recibo?.status === 'ok' ? 'aceito_fcm_apns' : 'recibo_recusado' } });
  }
}
let ocupado = false;
function iniciarWorker() {
  const timer = setInterval(async () => {
    if (ocupado || !configuracao().disponivel) return;
    ocupado = true;
    try { await prepararFila(); await enviarFila(); await conferirRecibos(); }
    catch { console.warn('Verificação de notificações do motorista temporariamente indisponível.'); }
    finally { ocupado = false; }
  }, 5000);
  timer.unref(); return timer;
}
module.exports = { Aparelho, Entrega, registrar, autenticar, desconectar, configurarAvisos, status, configuracao, autorizar,
  proteger, revelar, tokenValido, mensagemPush, requisitarExpo, aindaValido, prepararFila, enviarFila, conferirRecibos, iniciarWorker };
