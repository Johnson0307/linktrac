const { readFile } = require('node:fs/promises');

const passo = 0.015;
const celula = valor => Math.floor(valor / passo);
const chave = (x, y) => `${x}:${y}`;
const pontoValido = p => Number.isFinite(p?.latitude) && Math.abs(p.latitude) <= 90 &&
  Number.isFinite(p?.longitude) && Math.abs(p.longitude) <= 180;
const limiteValido = valor => Number.isFinite(valor) && valor >= 5 && valor <= 150;
const caixas = (oeste, sul, leste, norte, acao) => {
  for (let x = celula(oeste); x <= celula(leste); x++)
    for (let y = celula(sul); y <= celula(norte); y++) acao(chave(x, y));
};
function inserir(indice, registro, oeste, sul, leste, norte) {
  caixas(oeste, sul, leste, norte, key => {
    if (!indice.has(key)) indice.set(key, []);
    indice.get(key).push(registro);
  });
}
function consultar(indice, oeste, sul, leste, norte) {
  const unicos = new Set();
  caixas(oeste, sul, leste, norte, key => {
    for (const registro of indice.get(key) || []) unicos.add(registro);
  });
  return [...unicos];
}

function indexar(base) {
  const vias = new Map();
  const radares = new Map();
  for (const via of base.vias) {
    if (!limiteValido(via.limite) || !Array.isArray(via.pontos)) continue;
    const celulas = new Set();
    for (let i = 1; i < via.pontos.length; i++) {
      const [ax, ay] = via.pontos[i - 1];
      const [bx, by] = via.pontos[i];
      if (![ax, ay, bx, by].every(Number.isFinite) || Math.abs(ax - bx) > 0.3 || Math.abs(ay - by) > 0.3) continue;
      caixas(Math.min(ax, bx), Math.min(ay, by), Math.max(ax, bx), Math.max(ay, by), key => celulas.add(key));
    }
    for (const key of celulas) {
      if (!vias.has(key)) vias.set(key, []);
      vias.get(key).push(via);
    }
  }
  for (const radar of base.radares) {
    if (pontoValido(radar)) inserir(radares, radar, radar.longitude, radar.latitude, radar.longitude, radar.latitude);
  }
  return { vias, radares };
}

let carregamento;
function obterBase() {
  const caminho = process.env.FISCALIZACAO_BASE_ARQUIVO;
  if (!caminho) return Promise.resolve(null);
  carregamento ??= readFile(caminho, 'utf8').then(texto => indexar(JSON.parse(texto))).catch(() => {
    console.error('Base viária da Linktrac indisponível.');
    return null;
  });
  return carregamento;
}

function vetor(ponto, posicao) {
  return [
    (ponto[0] - posicao.longitude) * 111320 * Math.cos(posicao.latitude * Math.PI / 180),
    (ponto[1] - posicao.latitude) * 111320,
  ];
}

function distanciaVia(via, posicao, direcao) {
  let menor = Infinity;
  for (let i = 1; i < via.pontos.length; i++) {
    const [ax, ay] = vetor(via.pontos[i - 1], posicao);
    const [bx, by] = vetor(via.pontos[i], posicao);
    const dx = bx - ax;
    const dy = by - ay;
    const segmento = dx * dx + dy * dy;
    if (!segmento) continue;
    if (direcao && Math.abs((dx * direcao[0] + dy * direcao[1]) / Math.sqrt(segmento)) < 0.75) continue;
    const t = Math.min(1, Math.max(0, -(ax * dx + ay * dy) / segmento));
    menor = Math.min(menor, Math.hypot(ax + t * dx, ay + t * dy));
  }
  return menor;
}

function direcaoMovimento(posicao, anterior) {
  const segundos = (new Date(posicao.dataHora) - new Date(anterior?.dataHora)) / 1000;
  if (!pontoValido(anterior) || segundos <= 0 || segundos > 30 || !Number.isFinite(segundos)) return null;
  const [dx, dy] = vetor([anterior.longitude, anterior.latitude], posicao);
  const distancia = Math.hypot(dx, dy);
  return distancia >= 15 && distancia / segundos <= 65 ? [dx / distancia, dy / distancia] : null;
}

function viasProximas(base, posicao, direcao) {
  const { longitude: x, latitude: y } = posicao;
  return consultar(base.vias, x - 0.001, y - 0.001, x + 0.001, y + 0.001)
    .map(via => ({ via, metros: distanciaVia(via, posicao, direcao) }))
    .filter(v => v.metros <= 22).sort((a, b) => a.metros - b.metros);
}

function localizarVia(base, posicao, anterior) {
  if (!base || !pontoValido(posicao)) return null;
  const candidatas = viasProximas(base, posicao, direcaoMovimento(posicao, anterior));
  const primeira = candidatas[0];
  if (!primeira || candidatas.some(v => v.via.limite !== primeira.via.limite && v.metros - primeira.metros < 8)) return null;
  const { id, nome, limite } = primeira.via;
  return { id, nome, limite, fonte: 'OpenStreetMap' };
}

function viaConfirmada(base, posicao, direcao) {
  const [primeira, segunda] = viasProximas(base, posicao);
  if (!primeira || primeira.metros > 12 || (segunda && segunda.metros - primeira.metros < 8)) return null;
  return distanciaVia(primeira.via, posicao, direcao) <= 12 ? primeira.via : null;
}

function sentidoCompativel(radar, leste, norte) {
  const azimute = radar.azimuteTrafego;
  if (Number.isFinite(azimute) && azimute >= 0 && azimute < 360) {
    const rad = azimute * Math.PI / 180;
    return leste * Math.sin(rad) + norte * Math.cos(rad) >= Math.cos(Math.PI / 6);
  }
  return radar.fonte === 'ANTT' && radar.sentido === 'Crescente/Decrescente';
}

function radarAdiante(base, posicao, anterior) {
  if (!base || !pontoValido(posicao) || !Number.isFinite(posicao.velocidade) || posicao.velocidade <= 0 ||
      posicao.fonte === 'simulado' || anterior?.fonte === 'simulado') return null;
  const direcao = direcaoMovimento(posicao, anterior);
  if (!direcao) return null;
  const via = viaConfirmada(base, posicao, direcao);
  if (!via || viaConfirmada(base, anterior, direcao) !== via) return null;
  const [leste, norte] = direcao.map(valor => -valor);
  const { longitude: x, latitude: y } = posicao;
  const alcance = Math.min(300, Math.max(80, posicao.velocidade / 3.6 * 15));
  const candidatos = [];
  for (const radar of consultar(base.radares, x - 0.004, y - 0.004, x + 0.004, y + 0.004)) {
    if (!sentidoCompativel(radar, leste, norte)) continue;
    const [dx, dy] = vetor([radar.longitude, radar.latitude], posicao);
    const distancia = Math.hypot(dx, dy);
    const avanco = dx * leste + dy * norte;
    if (distancia > alcance || avanco < 10 || avanco < 0.85 * distancia) continue;
    if (viaConfirmada(base, radar, direcao) !== via) continue;
    candidatos.push({ radar, distancia });
  }
  const proximo = candidatos.sort((a, b) => a.distancia - b.distancia)[0];
  if (!proximo) return null;
  const { radar, distancia } = proximo;
  return {
    id: radar.id, nome: radar.nome, fonte: radar.fonte, metros: Math.round(distancia),
    limite: limiteValido(radar.limite) ? radar.limite : null,
  };
}

function eventosViarios(base, posicao, anterior) {
  if (!base || !pontoValido(posicao) || !Number.isFinite(posicao.velocidade) || posicao.velocidade <= 0 || posicao.fonte === 'simulado') return [];
  const via = localizarVia(base, posicao, anterior);
  const eventos = [];
  if (via && posicao.velocidade > via.limite) eventos.push({
    tipo: 'velocidade_via', id: via.id,
    mensagem: `GPS: ${posicao.velocidade} km/h em ${via.nome}, limite mapeado de ${via.limite} km/h (OpenStreetMap). Confira a sinalização.`,
  });
  const equipamento = radarAdiante(base, posicao, anterior);
  if (equipamento) eventos.push({
    tipo: 'aproximacao_fiscalizacao', id: equipamento.id,
    mensagem: `${equipamento.nome} a aproximadamente ${equipamento.metros} m (${equipamento.fonte}). GPS: ${posicao.velocidade} km/h.` +
      (equipamento.limite == null ? '' : ` Limite publicado: ${equipamento.limite} km/h.`),
  });
  return eventos;
}

async function camadaViaria(limites, zoom) {
  const base = await obterBase();
  if (!base || zoom < 12) return { vias: [], radares: [], disponivel: Boolean(base) };
  const { oeste, sul, leste, norte } = limites;
  const radares = consultar(base.radares, oeste, sul, leste, norte)
    .filter(p => p.longitude >= oeste && p.longitude <= leste && p.latitude >= sul && p.latitude <= norte).slice(0, 500);
  const vias = zoom >= 15 ? consultar(base.vias, oeste, sul, leste, norte).slice(0, 350) : [];
  return { vias, radares, disponivel: true };
}

module.exports = { indexar, obterBase, localizarVia, radarAdiante, eventosViarios, camadaViaria };
