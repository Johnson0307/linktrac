const { metrosEntre } = require('./telemetria');

const pontoValido = (p) => Number.isFinite(p?.latitude) && Math.abs(p.latitude) <= 90 &&
  Number.isFinite(p?.longitude) && Math.abs(p.longitude) <= 180;

async function consulta(base, caminho, params, lerErroOsrm = false) {
  const endereco = base.trim();
  const url = new URL(caminho, endereco.endsWith('/') ? endereco : endereco + '/');
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Provedor inválido.');
  for (const [chave, valor] of Object.entries(params)) url.searchParams.set(chave, valor);
  const resposta = await fetch(url, {
    signal: AbortSignal.timeout(10000), redirect: 'error',
    headers: { Accept: 'application/json', 'User-Agent': 'Linktrac-TMS/1.0' },
  });
  if (!resposta.ok) {
    if (lerErroOsrm && resposta.status === 400) {
      const erro = await resposta.json();
      if (['NoRoute', 'NoSegment'].includes(erro.code)) return erro;
    }
    throw new Error('Provedor indisponível.');
  }
  return resposta.json();
}

const osrm = (servico, pontos, params, base = process.env.TMS_OSRM_URL, lerErro = false) => {
  const coordenadas = pontos.map(p => `${p.longitude.toFixed(6)},${p.latitude.toFixed(6)}`).join(';');
  return consulta(base, `${servico}/v1/driving/${coordenadas}`, params, lerErro);
};

async function localizar(endereco) {
  const resultados = await consulta(process.env.TMS_GEOCODIFICADOR_URL, 'search', {
    q: endereco, format: 'jsonv2', limit: '5', countrycodes: 'br',
  });
  if (!Array.isArray(resultados)) throw new Error('Geocodificador inválido.');
  return resultados.slice(0, 5).map(p => ({
    endereco: String(p.display_name || '').slice(0, 500),
    latitude: Number.parseFloat(p.lat), longitude: Number.parseFloat(p.lon),
  })).filter(p => p.endereco && pontoValido(p));
}

const numeroValido = (valor) => typeof valor === 'number' && Number.isFinite(valor) && valor >= 0;
const geometriaValida = pontos => Array.isArray(pontos) && pontos.length >= 2 &&
  pontos.every(c => Array.isArray(c) && pontoValido({ latitude: c[1], longitude: c[0] }));
const passagensValidas = pontos => Array.isArray(pontos) && pontos.length <= 3 && pontos.every(pontoValido);

async function obterRota(pontos, { detalhar = false, base } = {}) {
  const resposta = await osrm('route', pontos, {
    overview: 'simplified', geometries: 'geojson', steps: String(detalhar),
    ...(base ? { radiuses: pontos.map(() => 500).join(';') } : {}),
  }, base, Boolean(base));
  if (base && ['NoRoute', 'NoSegment'].includes(resposta.code)) {
    const indice = /coordinate\s+(\d+)/i.exec(resposta.message || '');
    throw Object.assign(new Error('Rota viária indisponível para os pontos selecionados.'), {
      codigoRota: resposta.code,
      indice: indice ? Number(indice[1]) : null,
    });
  }
  const rota = resposta.routes?.[0];
  const geometria = rota?.geometry?.coordinates;
  if (resposta.code !== 'Ok' || !geometriaValida(geometria)) {
    throw new Error('Trajeto por ruas indisponível.');
  }
  const trechos = detalhar ? rota.legs?.map(trecho =>
    (trecho.steps || []).flatMap(passo => passo.geometry?.coordinates || [])) : [geometria];
  if (detalhar && (trechos?.length !== pontos.length - 1 || !trechos.every(geometriaValida))) {
    throw new Error('Trechos da rota indisponíveis.');
  }
  return { geometria, trechos, distancia: rota.distance, duracao: rota.duration };
}

async function obterRotaTomTom(pontos, chave) {
  const coordenadas = pontos.map(p => `${p.latitude.toFixed(6)},${p.longitude.toFixed(6)}`).join(':');
  const resposta = await consulta('https://api.tomtom.com/', `routing/1/calculateRoute/${coordenadas}/json`,
    { key: chave, routeType: 'fastest', traffic: 'true' });
  const rota = resposta.routes?.[0];
  const trechos = rota?.legs?.map(trecho => trecho.points?.map(p => [p.longitude, p.latitude]));
  if (trechos?.length !== pontos.length - 1 || !trechos.every(geometriaValida)) {
    throw new Error('Trajeto TomTom indisponível.');
  }
  return {
    trechos, geometria: trechos.flat(),
    distancia: rota.summary?.lengthInMeters, duracao: rota.summary?.travelTimeInSeconds,
  };
}

async function rotaEntrePontos(origem, destino, passagens = []) {
  const pontos = [origem, ...passagens, destino];
  const chave = process.env.ROTA_MAPA_TOMTOM_API_KEY?.trim();
  const base = process.env.ROTA_MAPA_OSRM_URL?.trim() || process.env.TMS_OSRM_URL?.trim();
  if (!base && !chave) {
    const metros = pontos.slice(1).reduce((total, ponto, i) => total + metrosEntre(pontos[i], ponto), 0);
    return { porRuas: false, distanciaKm: metros / 1000 };
  }
  const { geometria, trechos, distancia, duracao } = chave
    ? await obterRotaTomTom(pontos, chave) : await obterRota(pontos, { detalhar: passagens.length > 0, base });
  if (!numeroValido(distancia) || !numeroValido(duracao)) throw new Error('Distância ou duração inválida.');
  return { porRuas: true, provedor: chave ? 'tomtom' : 'osrm', geometria, trechos,
    distanciaKm: distancia / 1000, duracaoSegundos: duracao };
}

function avaliar(ordem, duracoes, distancias, paradas, partida, retornar) {
  let atual = 0;
  let tempo = partida;
  let distancia = 0;
  let atrasos = 0;
  let atrasoTotal = 0;
  const etapas = [];
  const visitados = new Set();
  for (const proximo of ordem) {
    const duracao = duracoes[atual][proximo];
    const trecho = distancias[atual][proximo];
    if (!numeroValido(duracao) || !numeroValido(trecho)) return null;
    const p = paradas[proximo - 1];
    if (p.precedenteId && !visitados.has(p.precedenteId)) return null;
    visitados.add(p.id);
    distancia += trecho;
    tempo += duracao * 1000;
    const chegada = tempo;
    if (p.janelaInicio) tempo = Math.max(tempo, Date.parse(p.janelaInicio));
    const atraso = p.janelaFim ? Math.max(0, tempo - Date.parse(p.janelaFim)) : 0;
    if (atraso) atrasos += 1;
    atrasoTotal += atraso;
    etapas.push({
      ...p, distanciaTrechoKm: trecho / 1000,
      chegadaEstimada: new Date(chegada).toISOString(),
      inicioAtendimento: new Date(tempo).toISOString(),
      janelaExcedida: atraso > 0,
    });
    tempo += (p.minutosServico ?? 10) * 60000;
    atual = proximo;
  }
  if (retornar && ordem.length) {
    if (!numeroValido(duracoes[atual][0]) || !numeroValido(distancias[atual][0])) return null;
    tempo += duracoes[atual][0] * 1000;
    distancia += distancias[atual][0];
  }
  return { etapas, atrasos, atrasoTotal, distancia, tempo };
}

const melhorQue = (a, b) => !b ||
  a.atrasos < b.atrasos ||
  (a.atrasos === b.atrasos && (a.atrasoTotal < b.atrasoTotal ||
    (a.atrasoTotal === b.atrasoTotal && (a.tempo < b.tempo ||
      (a.tempo === b.tempo && a.distancia < b.distancia)))));

async function planejar({ paradas, origem, partida, retornar, velocidadeMedia }) {
  const pontos = [origem, ...paradas];
  const porRuas = Boolean(process.env.TMS_OSRM_URL?.trim());
  const matriz = porRuas
    ? await osrm('table', pontos, { annotations: 'duration,distance' })
    : null;
  if (porRuas && (matriz.code !== 'Ok' || ![matriz.durations, matriz.distances].every(
    linhas => Array.isArray(linhas) && linhas.length === pontos.length &&
      linhas.every(linha => Array.isArray(linha) && linha.length === pontos.length)
  ))) throw new Error('Matriz do roteador indisponível.');
  const distancias = matriz?.distances ?? pontos.map(p => pontos.map(q => metrosEntre(p, q)));
  const duracoes = matriz?.durations ?? distancias.map(linha => linha.map(m => m * 3.6 / velocidadeMedia));
  const restantes = paradas.map((_, i) => i + 1);
  let ordem = [];
  let melhor;
  const inicio = Date.parse(partida);
  while (restantes.length) {
    let escolhido;
    let melhorParcial;
    for (const indice of restantes) {
      const candidato = avaliar([...ordem, indice], duracoes, distancias, paradas, inicio, false);
      if (candidato && melhorQue(candidato, melhorParcial)) {
        melhorParcial = candidato;
        escolhido = indice;
      }
    }
    if (escolhido === undefined) throw new Error('Uma parada não é alcançável pelo roteador.');
    ordem.push(escolhido);
    restantes.splice(restantes.indexOf(escolhido), 1);
  }
  melhor = avaliar(ordem, duracoes, distancias, paradas, inicio, retornar);
  for (let rodada = 0; rodada < 2; rodada++) {
    for (let i = 0; i < ordem.length - 1; i++) {
      for (let j = i + 1; j < ordem.length; j++) {
        const tentativa = [...ordem];
        [tentativa[i], tentativa[j]] = [tentativa[j], tentativa[i]];
        const candidato = avaliar(tentativa, duracoes, distancias, paradas, inicio, retornar);
        if (candidato && melhorQue(candidato, melhor)) {
          melhor = candidato;
          ordem = tentativa;
        }
      }
    }
  }
  if (!melhor) throw new Error('O retorno ao ponto de partida não é alcançável.');
  const percurso = [origem, ...melhor.etapas, ...(retornar ? [origem] : [])];
  const geometria = porRuas ? (await obterRota(percurso)).geometria : undefined;
  return {
    etapas: melhor.etapas, geometria, origem, retornar, porRuas,
    distanciaKm: melhor.distancia / 1000, terminoEstimado: new Date(melhor.tempo).toISOString(),
    janelasExcedidas: melhor.atrasos,
  };
}

module.exports = { pontoValido, passagensValidas, localizar, planejar, rotaEntrePontos };
