const mongoose = require('mongoose');
const { createCipheriv, createDecipheriv, randomBytes, randomUUID } = require('node:crypto');
const Motorista = require('../models/Motorista');
const erro = (status, mensagem) => Object.assign(new Error(mensagem), { status });
const provedores = { solides: 'Sólides Ponto / Tangerino', pontomais: 'VR / Pontomais', pontotel: 'Pontotel', oitchau: 'Oitchau', senior: 'Senior', outro: 'Outro fornecedor' };
const configSchema = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  provedor: { type: String, enum: Object.keys(provedores), default: 'solides' }, nomeOutro: String,
  liberada: { type: Boolean, default: false }, credencial: { type: String, select: false },
  revisao: String, atualizadoPor: String, testeEm: Date, testeEstado: String,
  tentativaEm: Date,
}, { timestamps: true });
const vinculoSchema = new mongoose.Schema({
  clienteId: { type: mongoose.Schema.Types.ObjectId, required: true },
  motoristaId: { type: mongoose.Schema.Types.ObjectId, required: true },
  provedor: { type: String, enum: Object.keys(provedores), required: true },
  colaboradorExterno: { type: String, required: true }, atualizadoPor: String,
}, { timestamps: true });
vinculoSchema.index({ clienteId: 1, provedor: 1, motoristaId: 1 }, { unique: true });
vinculoSchema.index({ clienteId: 1, provedor: 1, colaboradorExterno: 1 }, { unique: true });
const Conta = mongoose.model('ContaIntegracaoPonto', configSchema);
const Vinculo = mongoose.model('VinculoIntegracaoPonto', vinculoSchema);
function chave() {
  const valor = process.env.INTEGRACOES_CHAVE_CRIPTOGRAFIA || process.env.FINANCEIRO_CHAVE_CRIPTOGRAFIA;
  if (!/^[a-f0-9]{64}$/i.test(valor || '')) throw erro(503, 'A proteção de credenciais precisa ser configurada no servidor.');
  return Buffer.from(valor, 'hex');
}
function protecaoDisponivel() { try { chave(); return true; } catch { return false; } }
function proteger(token, empresa) {
  const iv = randomBytes(12), cifra = createCipheriv('aes-256-gcm', chave(), iv);
  cifra.setAAD(Buffer.from('solides-ponto:' + empresa));
  return Buffer.concat([iv, cifra.update(token, 'utf8'), cifra.final(), cifra.getAuthTag()]).toString('base64');
}
function revelar(valor, empresa) {
  const bytes = Buffer.from(valor, 'base64');
  const cifra = createDecipheriv('aes-256-gcm', chave(), bytes.subarray(0, 12));
  cifra.setAAD(Buffer.from('solides-ponto:' + empresa)); cifra.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cifra.update(bytes.subarray(12, -16)), cifra.final()]).toString('utf8');
}
function validarConta(body) {
  if (!body || typeof body.liberada !== 'boolean' || typeof body.token !== 'string' ||
      body.token.length > 4096 || (body.token && (body.token.length < 20 || /\s/.test(body.token)))) {
    throw erro(400, 'Informe a situação da liberação e um token válido, sem espaços. Deixe o token vazio para manter o atual.');
  }
  if (!Object.hasOwn(provedores, body.provedor) || typeof body.nomeOutro !== 'string' || body.nomeOutro.length > 100 ||
      /[\x00-\x1f\x7f]/.test(body.nomeOutro) || (body.provedor === 'outro' && !body.nomeOutro.trim())) throw erro(400, 'Selecione o fornecedor de ponto e informe o nome quando escolher Outro.');
  if (body.provedor !== 'solides' && body.token) throw erro(400, 'O armazenamento de credenciais deste fornecedor depende da implementação do conector.');
  return { liberada: body.liberada, token: body.token, provedor: body.provedor, nomeOutro: body.nomeOutro.trim() };
}
function publico(conta) {
  return { provedor: conta?.provedor || 'solides', nomeOutro: conta?.nomeOutro || '', liberada: Boolean(conta?.liberada), temToken: Boolean(conta?.credencial),
    protecaoDisponivel: protecaoDisponivel(), atualizadoEm: conta?.updatedAt || null,
    testeEm: conta?.testeEm || null, testeEstado: conta?.testeEstado || 'nao_testado',
    sincronizacao: 'aguardando_validacao_do_fornecedor' };
}
async function obterConta(empresa) {
  return publico(await Conta.findById(empresa).select('+credencial').lean());
}
async function salvarConta(empresa, usuario, body) {
  const dados = validarConta(body);
  const atual = await Conta.findById(empresa).select('provedor revisao').lean();
  const mudou = Boolean(atual && atual.provedor !== dados.provedor);
  const mudancas = { provedor: dados.provedor, nomeOutro: dados.nomeOutro, liberada: dados.liberada,
    revisao: randomUUID(), atualizadoPor: usuario, testeEstado: 'nao_testado' };
  if (dados.token) mudancas.credencial = proteger(dados.token, empresa);
  const salvo = await Conta.findOneAndUpdate({ _id: empresa, ...(atual ? { revisao: atual.revisao } : {}) }, {
    $set: mudancas, $unset: { testeEm: '', tentativaEm: '', ...(mudou && !dados.token ? { credencial: '' } : {}) },
  }, { upsert: !atual, new: true, runValidators: true }).select('+credencial').lean();
  if (!salvo) throw erro(409, 'A configuração mudou. Atualize a página antes de salvar novamente.');
  return publico(salvo);
}
async function desconectar(empresa, usuario) {
  await Conta.updateOne({ _id: empresa }, { $set: { liberada: false, revisao: randomUUID(),
    atualizadoPor: usuario, testeEstado: 'nao_testado' }, $unset: { credencial: '', testeEm: '', tentativaEm: '' } });
}
async function verificarCredencial(token, enviar = fetch) {
  // O endereço é fixo: tokens nunca são enviados a URLs fornecidas pelo usuário.
  try {
    const resposta = await enviar('https://employer.tangerino.com.br/test', {
      method: 'GET', headers: { Authorization: 'Basic ' + token, Accept: 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(8000),
    });
    // Não lemos nem devolvemos o conteúdo: ele pode conter dados pessoais ou credenciais.
    if (resposta.body?.cancel) await resposta.body.cancel();
    if (resposta.status === 200) return 'conexao_aceita';
    if ([401, 403].includes(resposta.status)) return 'acesso_recusado';
    if (resposta.status === 404) return 'endereco_pendente';
    if (resposta.status === 429) return 'limite_fornecedor';
    return 'fornecedor_indisponivel';
  } catch { return 'fornecedor_indisponivel'; }
}
async function testarConta(empresa) {
  const atual = await Conta.findById(empresa).select('+credencial').lean();
  if (atual?.provedor !== 'solides') throw erro(409, 'O conector deste fornecedor ainda precisa ser desenvolvido e validado.');
  if (!atual.credencial) throw erro(409, 'Cadastre o token fornecido pela Sólides.');
  let token;
  try { token = revelar(atual.credencial, empresa); } catch { throw erro(503, 'Não foi possível abrir a credencial. Confira a proteção no servidor ou cadastre novamente o token.'); }
  const agora = new Date();
  const reservado = await Conta.findOneAndUpdate({ _id: empresa, revisao: atual.revisao,
    $or: [{ tentativaEm: { $exists: false } },
      { tentativaEm: { $lt: new Date(agora.getTime() - 30000) } }] },
  { $set: { tentativaEm: agora } });
  if (!reservado) throw erro(429, 'Aguarde 30 segundos entre testes ou atualize a configuração.');
  const estado = await verificarCredencial(token);
  await Conta.updateOne({ _id: empresa, revisao: atual.revisao }, {
    $set: { testeEm: agora, testeEstado: estado },
  });
  return { estado, em: agora, aviso: 'Este teste verifica somente o acesso inicial. Não valida a API de marcações, o plano contratado nem a coleta de ponto pela Linktrac.' };
}
function validarVinculo(body) {
  const { id } = require('../operacao/validacao');
  if (!id(body?.motoristaId) || typeof body.colaboradorExterno !== 'string' ||
      !/^[\w.-]{1,80}$/.test(body.colaboradorExterno)) {
    throw erro(400, 'Selecione um motorista e informe o ID ou identificador externo do colaborador na Sólides.');
  }
  return { motoristaId: body.motoristaId, colaboradorExterno: body.colaboradorExterno };
}
async function salvarVinculo(empresa, usuario, body) {
  const dados = validarVinculo(body);
  const conta = await Conta.findById(empresa).select('provedor').lean();
  const provedor = conta?.provedor || 'solides';
  if (!await Motorista.exists({ _id: dados.motoristaId, clienteId: empresa })) throw erro(404, 'Motorista não encontrado na sua empresa.');
  return Vinculo.findOneAndUpdate({ clienteId: empresa, provedor, motoristaId: dados.motoristaId }, {
    $set: { colaboradorExterno: dados.colaboradorExterno, atualizadoPor: usuario },
  }, { upsert: true, new: true, runValidators: true });
}
module.exports = { Conta, Vinculo, obterConta, salvarConta, desconectar, testarConta, salvarVinculo,
  provedores, proteger, revelar, validarConta, validarVinculo, verificarCredencial, publico };
