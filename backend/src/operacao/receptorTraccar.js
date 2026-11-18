const { readFile } = require('node:fs/promises');
const { Dispositivo } = require('./modelos');

async function aplicarCadastros({ listar, requisitar }) {
  const cadastros = await listar();
  const dispositivos = await requisitar('devices');
  if (!Array.isArray(dispositivos)) throw new Error('Lista inválida no Traccar');
  const desejados = new Map(cadastros.map(doc => [doc.codigoExterno, doc]));
  const registrados = new Map(dispositivos.map(doc => [doc.uniqueId, doc]));
  let conflito = false;
  for (const atual of dispositivos) {
    if (atual.attributes?.linktracCadastro && !atual.disabled && !desejados.has(atual.uniqueId)) {
      await requisitar(`devices/${atual.id}`, 'PUT', { ...atual, disabled: true });
    }
  }
  for (const [codigo, cadastro] of desejados) {
    const atual = registrados.get(codigo);
    const vinculo = String(cadastro._id);
    if (atual && !atual.attributes?.linktracCadastro) {
      conflito = true;
      continue;
    }
    const nome = `Linktrac • ${codigo.slice(-4)}`;
    if (atual && atual.attributes.linktracCadastro === vinculo && !atual.disabled && atual.name === nome) continue;
    const equipamento = {
      ...atual, uniqueId: codigo, name: nome, disabled: false,
      attributes: { ...atual?.attributes, linktracCadastro: vinculo },
    };
    await requisitar(atual ? `devices/${atual.id}` : 'devices', atual ? 'PUT' : 'POST', equipamento);
  }
  if (conflito) throw new Error('Dispositivo precisa ser associado ao receptor Linktrac');
}

function iniciarReceptorTraccar() {
  const { TRACCAR_API_URL, TRACCAR_API_AUTH_FILE } = process.env;
  if (!TRACCAR_API_URL || !TRACCAR_API_AUTH_FILE) return;
  let pendente;
  let falhaAnterior = false;
  const sincronizar = () => {
    if (pendente) return;
    pendente = sincronizarCadastros().then(() => {
      if (falhaAnterior) console.info('Sincronização de rastreadores retomada.');
      falhaAnterior = false;
    }).catch(() => {
      if (!falhaAnterior) console.error('Sincronização de rastreadores com Traccar indisponível.');
      falhaAnterior = true;
    }).finally(() => { pendente = null; });
  };

  async function sincronizarCadastros() {
    const { email, password } = JSON.parse(await readFile(TRACCAR_API_AUTH_FILE, 'utf8'));
    const authorization = `Basic ${Buffer.from(`${email}:${password}`).toString('base64')}`;
    const requisitar = async (recurso, method = 'GET', corpo) => {
      const resposta = await fetch(new URL(recurso, TRACCAR_API_URL), {
        method, redirect: 'error', signal: AbortSignal.timeout(10000),
        headers: { authorization, 'content-type': 'application/json' },
        body: JSON.stringify(corpo),
      });
      if (!resposta.ok) throw new Error(`Traccar HTTP ${resposta.status}`);
      return resposta.json();
    };
    await aplicarCadastros({
      listar: () => Dispositivo.find({ ativo: true, receptorTraccar: true })
        .select('_id codigoExterno').lean(),
      requisitar,
    });
  }
  sincronizar();
  setInterval(sincronizar, 30000).unref();
}

module.exports = { aplicarCadastros, iniciarReceptorTraccar };
