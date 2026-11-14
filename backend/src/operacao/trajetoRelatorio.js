const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const { id, horario } = require('./validacao');
const { metrosEntre } = require('./telemetria');
const { simulado } = require('../services/resumoPainel');

const diaMs = 86400000;
const limitePontos = 50000;
const intervaloMaximoSegundos = 300;

function falha(status, mensagem) {
  throw Object.assign(new Error(mensagem), { status });
}

const valido = p => p.fonte !== 'simulado' && p.status !== 'Sem sinal' && p.dataHora &&
  Number.isFinite(new Date(p.dataHora).getTime()) && Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
  Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;

function medirTrajeto(posicoes) {
  let pontosValidos = 0;
  let descartados = 0;
  let interrupcoes = 0;
  let saltos = 0;
  let metros = 0;
  let intervalos = 0;
  let primeiro = null;
  let ultimo = null;
  let anterior = null;
  let trecho = null;
  const trechos = [];
  for (const p of posicoes) {
    if (!valido(p)) {
      descartados++;
      anterior = null;
      trecho = null;
      continue;
    }
    const instante = new Date(p.dataHora);
    if (ultimo && instante <= ultimo) {
      descartados++;
      continue;
    }
    pontosValidos++;
    primeiro ??= instante;
    ultimo = instante;
    if (anterior) {
      const segundos = (instante - new Date(anterior.dataHora)) / 1000;
      const distancia = metrosEntre(anterior, p);
      const salto = distancia * 3.6 / segundos > 300;
      if (segundos <= intervaloMaximoSegundos && !salto) {
        if (!trecho) {
          trecho = [anterior];
          trechos.push(trecho);
        }
        trecho.push(p);
        intervalos++;
        metros += distancia;
        anterior = p;
        continue;
      }
      if (segundos <= intervaloMaximoSegundos) saltos++;
    }
    if (pontosValidos > 1) interrupcoes++;
    trecho = null;
    anterior = p;
  }
  return { resumo: { pontosValidos, descartados, interrupcoes, saltos, primeiro, ultimo, intervalos,
    distanciaKm: intervalos ? metros / 1000 : null, trechos: trechos.length, intervaloMaximoSegundos },
  trechos };
}

async function consultarTrajeto(clienteId, body) {
  const { veiculoId, inicio, fim, circuito = '' } = body || {};
  if (!id(veiculoId) || !horario(inicio) || !horario(fim) || Date.parse(inicio) >= Date.parse(fim) ||
      Date.parse(fim) - Date.parse(inicio) > 31 * diaMs || typeof circuito !== 'string' || circuito.length > 100) {
    falha(400, 'Selecione o veículo, um período de até 31 dias e uma referência de até 100 caracteres.');
  }
  const veiculo = await Veiculo.findOne({ _id: veiculoId, clienteId }).select('placa marca modelo').lean();
  if (!veiculo) falha(404, 'Veículo da empresa não encontrado.');
  if (simulado(veiculo)) falha(422, 'Selecione um veículo real para emitir este relatório.');
  const dados = await require('../services/historicoArquivo').consultarHistorico(Localizacao, { veiculoId, dataHora: { $gte: new Date(inicio), $lte: new Date(fim) },
    fonte: { $ne: 'simulado' },
  }, { campos: 'latitude longitude status dataHora fonte', ordem: 1, limite: limitePontos + 1, maxTimeMS: 12000 });
  if (dados.length > limitePontos) falha(422, 'O período tem mais de 50 mil posições. Reduza o intervalo para gerar o relatório completo.');
  const { resumo, trechos } = medirTrajeto(dados);
  return { resumo: { ...resumo, placa: veiculo.placa, circuito: circuito.trim(), inicio, fim }, trechos };
}

const escaparXml = valor => String(valor ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
  .replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);

function gerarKml({ resumo, trechos }) {
  if (!trechos.length) falha(422, 'O período não tem posições consecutivas suficientes para exportar um trajeto.');
  const titulo = escaparXml([resumo.placa, resumo.circuito].filter(Boolean).join(' · '));
  const metadados = Object.entries({ placa: resumo.placa, circuito: resumo.circuito, inicio: resumo.inicio, fim: resumo.fim,
    distanciaKmEstimada: resumo.distanciaKm.toFixed(3), pontosValidos: resumo.pontosValidos, interrupcoes: resumo.interrupcoes,
  }).map(([campo, valor]) => `<Data name="${campo}"><value>${escaparXml(valor)}</value></Data>`).join('');
  const linhas = trechos.map((trecho, i) => {
    const inicio = new Date(trecho[0].dataHora).toISOString();
    const fim = new Date(trecho.at(-1).dataHora).toISOString();
    const coords = trecho.map(p => `${p.longitude.toFixed(8)},${p.latitude.toFixed(8)}`).join(' ');
    return `<Placemark><name>Trecho ${i + 1}</name><TimeSpan><begin>${inicio}</begin><end>${fim}</end></TimeSpan><LineString><coordinates>${coords}</coordinates></LineString></Placemark>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${titulo}</name><description>Trajeto observado por GPS. Distância estimada entre posições registradas.</description><ExtendedData>${metadados}</ExtendedData>\n${linhas}\n</Document></kml>\n`;
}

module.exports = { consultarTrajeto, gerarKml, medirTrajeto };
