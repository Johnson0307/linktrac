const { createHash, createHmac } = require('node:crypto');
const { Notificacao } = require('./modelos');
const Veiculo = require('../models/Veiculo');
const { id } = require('./validacao');
const { telefoneWhatsApp } = require('./telefoneWhatsApp');
const { Configuracao } = require('./configuracao');
const hash = valor => createHash('sha256').update(valor).digest('hex');
const tipoAlertaAlimentacao = 'alimentacao_desconectada';
const horarioAlerta = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo',
});

function configuracao(env = process.env) {
  const empresa = env.ALERTAS_EMPRESA_ID?.trim();
  if (!id(empresa)) return { canais: {} };
  const canais = {};
  const segredo = env.ALERTAS_WEBHOOK_SEGREDO?.trim();
  if (segredo?.length >= 32 && env.ALERTAS_WEBHOOK_URL?.trim()) {
    try {
      const url = new URL(env.ALERTAS_WEBHOOK_URL);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.hash) {
        canais.webhook = { url: url.href, segredo, destino: url.href };
      }
    } catch { /* URL incompleta: o canal permanece desativado. */ }
  }
  const chave = env.ALERTAS_RESEND_CHAVE?.trim();
  const de = env.ALERTAS_EMAIL_DE?.trim();
  const para = env.ALERTAS_EMAIL_PARA?.trim();
  if (chave && de && para && /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/.test(para)) {
    canais.email = { chave, de, para, destino: `${de}\n${para}` };
  }
  const numeroId = env.ALERTAS_WHATSAPP_NUMERO_ID?.trim();
  const token = env.ALERTAS_WHATSAPP_TOKEN?.trim();
  const versao = env.ALERTAS_WHATSAPP_VERSAO?.trim();
  const modelo = env.ALERTAS_WHATSAPP_MODELO?.trim();
  if (/^\d{5,30}$/.test(numeroId || '') && token && /^v\d{1,3}\.\d+$/.test(versao || '') &&
      /^[a-z0-9_]{1,100}$/.test(modelo || '')) {
    canais.whatsapp = { token, numeroId, versao, modelo, destino: `${numeroId}/${modelo}` };
  }
  for (const canal of Object.values(canais)) canal.destino = hash(canal.destino);
  return { empresa, canais };
}

function assunto(tipo) {
  if (tipo === 'comunicacao') return 'Equipamento sem comunicação';
  if (tipo === 'manutencao') return 'Manutenção pendente';
  if (/^cerca_.+_saida$/.test(tipo)) return 'Saída de cerca virtual';
  return '';
}

async function configuracaoDeEnvio(clienteId, config = configuracao()) {
  if (!config.canais.whatsapp || String(clienteId) !== config.empresa) return config;
  const registro = await Configuracao.findOne({ clienteId }).select('whatsappBusiness').lean();
  if (!registro?.whatsappBusiness?.numero ||
      registro.whatsappBusiness.numeroIdValidado === config.canais.whatsapp.numeroId) return config;
  const { whatsapp, ...canais } = config.canais;
  return { ...config, canais };
}

function prepararEntregas(clienteId, dados, agora = new Date(), config = configuracao(), veiculo) {
  if (String(clienteId) !== config.empresa || dados.simulado) return undefined;
  const canais = Object.entries(config.canais).filter(([nome]) => nome !== 'whatsapp' && assunto(dados.tipo));
  const entregas = Object.fromEntries(canais.map(([nome, c]) => [nome, {
    estado: 'pendente', tentativas: 0, proxima: agora, destino: c.destino,
  }]));
  const numero = telefoneWhatsApp(veiculo?.telefone);
  if (config.canais.whatsapp && dados.tipo === tipoAlertaAlimentacao && veiculo?.alertaAlimentacaoWhatsApp === true && numero) {
    entregas.whatsapp = { estado: 'pendente', tentativas: 0, proxima: agora,
      destino: config.canais.whatsapp.destino, contato: hash(numero) };
  }
  return Object.keys(entregas).length ? entregas : undefined;
}

async function enviar(nome, canal, evento, requisitar, veiculo) {
  const idEvento = String(evento._id);
  const headers = { 'Content-Type': 'application/json', 'Idempotency-Key': `linktrac/${idEvento}/${nome}` };
  let url, body;
  if (nome === 'whatsapp') {
    url = `https://graph.facebook.com/${canal.versao}/${canal.numeroId}/messages`;
    headers.Authorization = `Bearer ${canal.token}`;
    delete headers['Idempotency-Key'];
    body = JSON.stringify({
      messaging_product: 'whatsapp', to: telefoneWhatsApp(veiculo.telefone), type: 'template',
      template: { name: canal.modelo, language: { code: 'pt_BR' }, components: [{
        type: 'body', parameters: [veiculo.placa, horarioAlerta.format(evento.ocorridoEm)].map(text => ({ type: 'text', text })),
      }] },
    });
  } else if (nome === 'email') {
    url = 'https://api.resend.com/emails';
    headers.Authorization = `Bearer ${canal.chave}`;
    body = JSON.stringify({ from: canal.de, to: [canal.para], subject: `Linktrac · ${assunto(evento.tipo)}`, text: evento.mensagem });
  } else {
    url = canal.url;
    body = JSON.stringify({ id: idEvento, tipo: evento.tipo, veiculoId: evento.veiculoId,
      criadoEm: evento.createdAt, mensagem: evento.mensagem });
    headers['X-Linktrac-Signature'] = 'sha256=' + createHmac('sha256', canal.segredo).update(body).digest('hex');
  }
  const resposta = await requisitar(url, { method: 'POST', headers, body, redirect: 'error', signal: AbortSignal.timeout(5000) });
  await resposta.body?.cancel();
  if (!resposta.ok) throw Object.assign(new Error('Canal externo indisponível.'), { status: resposta.status });
}

async function processarAvisosExternos(config, requisitar = fetch) {
  if (!config) {
    const padrao = configuracao();
    config = await configuracaoDeEnvio(padrao.empresa, padrao);
  }
  for (const [nome, canal] of Object.entries(config.canais)) {
    const whatsapp = nome === 'whatsapp';
    const caminho = `entregasExternas.${nome}`;
    for (let i = 0; i < 8; i++) {
      const agora = new Date();
      const evento = await Notificacao.findOneAndUpdate({
        clienteId: config.empresa, simulado: { $ne: true }, createdAt: { $gte: new Date(agora - 12 * 3600000) },
        [`${caminho}.estado`]: 'pendente', [`${caminho}.destino`]: canal.destino, [`${caminho}.proxima`]: { $lte: agora },
      }, { $set: { [`${caminho}.proxima`]: new Date(agora.getTime() + 45000),
        ...(whatsapp ? { [`${caminho}.estado`]: 'resultado_incerto' } : {}) },
        $inc: { [`${caminho}.tentativas`]: 1 },
      }, { sort: { createdAt: 1 }, returnDocument: 'after' }).lean();
      if (!evento) break;
      const tentativas = evento.entregasExternas[nome].tentativas;
      const chave = { _id: evento._id, [`${caminho}.tentativas`]: tentativas };
      let estado = 'enviado';
      let proxima = null;
      try {
        const filtro = { _id: evento.veiculoId, clienteId: config.empresa,
          $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }] };
        const real = evento.veiculoId && (whatsapp ? await Veiculo.findOne({ ...filtro, ativo: { $ne: false } })
          .select('placa telefone alertaAlimentacaoWhatsApp').lean() : await Veiculo.exists(filtro));
        const numero = whatsapp && telefoneWhatsApp(real?.telefone);
        const autorizado = whatsapp ? evento.tipo === tipoAlertaAlimentacao && evento.ocorridoEm &&
          real?.alertaAlimentacaoWhatsApp === true && numero && hash(numero) === evento.entregasExternas.whatsapp.contato : assunto(evento.tipo);
        if (!real || !autorizado) estado = 'cancelado';
        else if (tentativas > 4) estado = 'falhou';
        else await enviar(nome, canal, evento, requisitar, real);
      } catch (erro) {
        if (whatsapp && (!erro.status || erro.status >= 500)) estado = 'resultado_incerto';
        else if (whatsapp && erro.status !== 429) estado = 'falhou';
        else estado = tentativas >= 4 ? 'falhou' : 'pendente';
        if (estado === 'pendente') proxima = new Date(agora.getTime() + 60000 * 2 ** tentativas);
      }
      await Notificacao.updateOne(chave, { $set: { [`${caminho}.estado`]: estado, [`${caminho}.proxima`]: proxima } });
    }
  }
}

module.exports = { configuracao, configuracaoDeEnvio, prepararEntregas, processarAvisosExternos, tipoAlertaAlimentacao, horarioAlerta };
