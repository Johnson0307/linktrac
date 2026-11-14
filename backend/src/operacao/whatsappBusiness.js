const { Configuracao, padroes } = require('./configuracao');
const { configuracao } = require('./avisosExternos');

function normalizarNumero(valor) {
  if (typeof valor !== 'string' || !/^\+?[\d(). -]{10,24}$/.test(valor.trim())) return null;
  const digitos = valor.replace(/\D/g, '');
  const numero = [10, 11].includes(digitos.length) ? '55' + digitos : digitos;
  return /^55[1-9]\d(?:[2-5]\d{7}|9\d{8})$/.test(numero) ? numero : null;
}

function canalDaEmpresa(clienteId) {
  const config = configuracao();
  return String(clienteId) === config.empresa ? config.canais.whatsapp : undefined;
}

async function consultarNumero(clienteId) {
  const registro = await Configuracao.findOne({ clienteId }).select('whatsappBusiness').lean();
  const salvo = registro?.whatsappBusiness;
  const canal = canalDaEmpresa(clienteId);
  return { numero: salvo?.numero || '', estado: !salvo?.numero ? 'sem_numero' :
    canal?.numeroId && canal.numeroId === salvo.numeroIdValidado ? 'validado' : 'pendente' };
}

const falha = (status, mensagem) => Object.assign(new Error(mensagem), { status });

async function salvarNumero(clienteId, entrada, requisitar = fetch) {
  const numero = normalizarNumero(entrada);
  if (!numero) throw falha(400, 'Informe um número brasileiro com DDD.');
  const canal = canalDaEmpresa(clienteId);
  if (canal) {
    let retorno;
    try {
      const resposta = await requisitar(`https://graph.facebook.com/${canal.versao}/${canal.numeroId}?fields=display_phone_number`, {
        headers: { Authorization: `Bearer ${canal.token}` }, signal: AbortSignal.timeout(5000), redirect: 'error',
      });
      if (!resposta.ok) throw new Error();
      retorno = normalizarNumero((await resposta.json()).display_phone_number);
      if (!retorno) throw new Error();
    } catch {
      throw falha(503, 'Não foi possível conferir o número na Meta. Tente novamente quando a conexão estiver disponível.');
    }
    if (retorno !== numero) throw falha(422, 'O número informado é diferente do WhatsApp Business conectado à Linktrac.');
  }
  await Configuracao.updateOne({ clienteId }, {
    $set: { whatsappBusiness: { numero, ...(canal ? { numeroIdValidado: canal.numeroId } : {}) } },
    $setOnInsert: { dados: padroes },
  }, { upsert: true });
  return { numero, estado: canal ? 'validado' : 'pendente' };
}

module.exports = { consultarNumero, salvarNumero };
