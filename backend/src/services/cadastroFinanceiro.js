const mongoose = require('mongoose');
const { createCipheriv, createDecipheriv, randomBytes, randomUUID } = require('node:crypto');
const { normalizarDocumento } = require('./documentoLogin');

const schemaConta = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  provedor: String,
  ambiente: String,
  carteira: String,
  credencial: { type: String, select: false },
  modelo: { type: Buffer, select: false },
  modeloNome: String,
}, { timestamps: true });
const schemaCadastro = new mongoose.Schema({
  _id: mongoose.Schema.Types.ObjectId,
  emissorId: { type: mongoose.Schema.Types.ObjectId, required: true },
  dados: {
    nome: String, documento: String, email: String, celular: String, cep: String, logradouro: String,
    numero: String, complemento: String, bairro: String, cidade: String, uf: String,
  },
  proximaTentativa: Date,
  trava: String,
  estado: String,
  referenciaExterna: String,
  destino: String,
  criadoNoBancoEm: Date,
  tentativaCriacaoEm: Date,
  contrato: { type: Buffer, select: false },
  contratoNome: String,
  contratoAnexadoEm: Date,
}, { timestamps: true });
schemaCadastro.index({ emissorId: 1, estado: 1, proximaTentativa: 1 });
const Conta = mongoose.model('ContaCobranca', schemaConta);
const Cadastro = mongoose.model('CadastroFinanceiro', schemaCadastro);
const falha = (status, mensagem) => Object.assign(new Error(mensagem), { status });

function validarDados(corpo) {
  const limites = { nome: 150, documento: 32, email: 200, celular: 24, cep: 12, logradouro: 150,
    numero: 20, complemento: 120, bairro: 100, cidade: 100, uf: 2 };
  const dados = {};
  for (const [campo, limite] of Object.entries(limites)) {
    const valor = corpo?.[campo] ?? '';
    if (typeof valor !== 'string' || valor.length > limite || /[\x00-\x1f\x7f]/.test(valor)) {
      throw falha(400, 'Confira os dados do pagador.');
    }
    dados[campo] = valor.trim();
  }
  dados.documento = normalizarDocumento(dados.documento);
  dados.celular = dados.celular.replace(/[()\s-]/g, '');
  dados.cep = dados.cep.replace(/-/g, '');
  dados.uf = dados.uf.toUpperCase();
  if (!dados.nome || !dados.documento || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(dados.email) ||
      !/^\d{8}$/.test(dados.cep) || !dados.logradouro || !dados.numero || !dados.bairro || !dados.cidade ||
      !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(dados.uf) ||
      (dados.celular && !/^\d{11}$/.test(dados.celular))) {
    throw falha(400, 'Informe nome, CPF/CNPJ válido, e-mail e endereço completo. Se preencher o celular, use DDD e 9 dígitos.');
  }
  return dados;
}

function chave() {
  const valor = process.env.FINANCEIRO_CHAVE_CRIPTOGRAFIA;
  if (!/^[a-f0-9]{64}$/i.test(valor || '')) throw falha(503, 'A proteção de credenciais ainda precisa ser configurada no servidor.');
  return Buffer.from(valor, 'hex');
}

function criptografar(token, contexto) {
  const iv = randomBytes(12);
  const cifra = createCipheriv('aes-256-gcm', chave(), iv);
  cifra.setAAD(Buffer.from(contexto));
  return Buffer.concat([iv, cifra.update(token), cifra.final(), cifra.getAuthTag()]).toString('base64');
}

function descriptografar(valor, contexto) {
  const bytes = Buffer.from(valor, 'base64');
  const cifra = createDecipheriv('aes-256-gcm', chave(), bytes.subarray(0, 12));
  cifra.setAAD(Buffer.from(contexto));
  cifra.setAuthTag(bytes.subarray(-16));
  return Buffer.concat([cifra.update(bytes.subarray(12, -16)), cifra.final()]).toString();
}

async function requisicaoAsaas(ambiente, token, caminho, corpo, enviar = fetch) {
  const host = ambiente === 'producao' ? 'https://api.asaas.com' : 'https://api-sandbox.asaas.com';
  const resposta = await enviar(`${host}/v3/${caminho}`, {
    method: corpo ? 'POST' : 'GET',
    headers: { access_token: token, 'User-Agent': 'Linktrac/1.0', 'Content-Type': 'application/json' },
    ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    signal: AbortSignal.timeout(8000), redirect: 'error',
  });
  if (!resposta.ok) throw Object.assign(new Error('Falha de comunicação com o Asaas.'), { statusExterno: resposta.status });
  return resposta.json();
}

const destinoDaConta = (conta) => `${conta.provedor}:${conta.ambiente}:${conta.carteira}`;
const contextoConta = (conta) => `${conta._id}:${destinoDaConta(conta)}`;

async function conectarAsaas(emissorId, entrada, enviar) {
  const { ambiente, token } = entrada || {};
  if (!['teste', 'producao'].includes(ambiente) || typeof token !== 'string' || !/^\S{12,512}$/.test(token)) {
    throw falha(400, 'Informe o ambiente e a chave de API do Asaas.');
  }
  chave();
  let carteira;
  try {
    ({ walletId: carteira } = await requisicaoAsaas(ambiente, token, 'wallets/', undefined, enviar));
    if (typeof carteira !== 'string' || !/^[a-z\d-]{5,100}$/i.test(carteira)) throw new Error();
  } catch {
    throw falha(422, 'Não foi possível validar a chave na conta Asaas. Confira o ambiente e a chave.');
  }
  const conta = { _id: emissorId, provedor: 'asaas', ambiente, carteira };
  await Conta.updateOne({ _id: emissorId }, { $set: {
    provedor: conta.provedor, ambiente, carteira, credencial: criptografar(token, contextoConta(conta)),
  } }, { upsert: true });
  return { provedor: conta.provedor, ambiente };
}

async function sincronizarCadastro(clienteId, emissorId, enviar) {
  const conta = await Conta.findById(emissorId).select('+credencial').lean();
  if (conta?.provedor !== 'asaas' || !conta.credencial) return;
  const destino = destinoDaConta(conta);
  const trava = randomUUID();
  const agora = new Date();
  const filtro = { _id: clienteId, emissorId };
  const cadastro = await Cadastro.findOneAndUpdate({
    ...filtro, estado: { $in: ['pendente', 'aguardando_conferencia'] }, proximaTentativa: { $lte: agora },
    $or: [{ destino }, { destino: { $exists: false } }],
  }, { $set: { destino, trava, proximaTentativa: new Date(+agora + 120000) } }, { returnDocument: 'after' }).lean();
  if (!cadastro) return;
  const guardado = { ...filtro, trava };
  let estado = cadastro.estado;
  try {
    const token = descriptografar(conta.credencial, contextoConta(conta));
    const d = cadastro.dados;
    const chamar = (caminho, corpo) => requisicaoAsaas(conta.ambiente, token, caminho, corpo, enviar);
    const buscar = async (campo, valor) => {
      const resultado = await chamar(`customers?${new URLSearchParams({ [campo]: valor, limit: '2' })}`);
      if (!Array.isArray(resultado.data)) throw new Error('Resposta inválida.');
      if (resultado.data.length > 1 || resultado.hasMore) throw falha(409, 'Mais de um pagador encontrado.');
      return resultado.data[0];
    };
    let pagador = await buscar('externalReference', String(clienteId));
    if (!pagador) pagador = await buscar('cpfCnpj', d.documento);
    if (pagador && (pagador.deleted || pagador.cpfCnpj !== d.documento ||
        (pagador.externalReference && pagador.externalReference !== String(clienteId)))) {
      throw falha(409, 'Existe um cadastro que exige conferência no Asaas.');
    }
    if (!pagador && cadastro.tentativaCriacaoEm) {
      estado = 'aguardando_conferencia';
      return;
    }
    if (!pagador) {
      const reserva = await Cadastro.updateOne(guardado, { $set: { tentativaCriacaoEm: agora } });
      if (!reserva.matchedCount) return;
      estado = 'aguardando_conferencia';
      try {
        pagador = await chamar('customers', {
          name: d.nome, cpfCnpj: d.documento, email: d.email, mobilePhone: d.celular || undefined,
          postalCode: d.cep, address: d.logradouro, addressNumber: d.numero, complement: d.complement || undefined,
          province: d.bairro, externalReference: String(clienteId), notificationDisabled: true,
        });
      } catch (erro) {
        if ([400, 401, 403, 422].includes(erro.statusExterno)) {
          await Cadastro.updateOne(guardado, { $unset: { tentativaCriacaoEm: '' } });
          estado = 'pendente';
        }
        throw erro;
      }
    }
    if (typeof pagador?.id !== 'string' || !/^cus_[a-z\d]+$/i.test(pagador.id)) throw new Error('Identificador inválido.');
    await Cadastro.updateOne(guardado, { $set: {
      estado: 'pronto', referenciaExterna: pagador.id, criadoNoBancoEm: new Date(),
    }, $unset: { trava: '', proximaTentativa: '', tentativaCriacaoEm: '' } });
  } catch (erro) {
    if (erro.status === 409) estado = 'conflito';
    if ([400, 422].includes(erro.statusExterno) && estado === 'pendente') estado = 'dados_rejeitados';
  } finally {
    await Cadastro.updateOne(guardado, { $set: { estado, proximaTentativa: new Date(Date.now() + 300000) }, $unset: { trava: '' } });
  }
}

function iniciarCobranca() {
  let executando = false;
  const timer = setInterval(async () => {
    if (executando || mongoose.connection.readyState !== 1) return;
    executando = true;
    try {
      const contas = Conta.find({ provedor: 'asaas' }).select('provedor ambiente carteira').lean().cursor();
      for await (const conta of contas) {
        const trabalhos = await Cadastro.find({ emissorId: conta._id, estado: { $in: ['pendente', 'aguardando_conferencia'] },
          proximaTentativa: { $lte: new Date() }, $or: [{ destino: destinoDaConta(conta) }, { destino: { $exists: false } }],
        }).sort({ proximaTentativa: 1 }).limit(10).select('_id').lean();
        for (const item of trabalhos) await sincronizarCadastro(item._id, conta._id);
      }
    } catch {
      console.warn('[Financeiro] Não foi possível consultar os cadastros pendentes.');
    } finally {
      executando = false;
    }
  }, 30000);
  timer.unref();
}

module.exports = { Conta, Cadastro, validarDados, conectarAsaas, sincronizarCadastro, iniciarCobranca, destinoDaConta, falha };
