const { metrosEntre } = require('./telemetria');

const tipoMovimentoSemIgnicao = 'movimento_sem_ignicao';
const maxIntervaloMs = 120000;
const distanciaMinima = 60;

function avaliarTrecho(pontos) {
  if (pontos.length !== 3 || pontos.some(p => p.ignicao !== false || p.status === 'Sem sinal' ||
      !Number.isFinite(p.latitude) || !Number.isFinite(p.longitude) ||
      Math.abs(p.latitude) > 90 || Math.abs(p.longitude) > 180)) return null;
  const tempos = pontos.map(p => +new Date(p.dataHora));
  const intervalos = [tempos[1] - tempos[0], tempos[2] - tempos[1]];
  if (!intervalos.every(t => t >= 5000 && t <= maxIntervaloMs) || tempos[2] - tempos[0] < 20000) return null;
  const distancias = [metrosEntre(pontos[0], pontos[1]), metrosEntre(pontos[1], pontos[2])];
  const compativeis = distancias.every((distancia, i) =>
    distancia >= 15 && distancia * 3600 / intervalos[i] <= 160 &&
    Number.isFinite(pontos[i + 1].velocidade) && pontos[i + 1].velocidade >= 7);
  const deslocamento = metrosEntre(pontos[0], pontos[2]);
  return compativeis && deslocamento >= distanciaMinima ? Math.round(deslocamento) : null;
}

// Uma ocorrência por sequência contínua que satisfaz a regra.
function detectarMovimentoSemIgnicao(pontos) {
  const distancia = avaliarTrecho(pontos.slice(-3));
  return distancia && !avaliarTrecho(pontos.slice(-4, -1)) ? distancia : null;
}

module.exports = { detectarMovimentoSemIgnicao, tipoMovimentoSemIgnicao, maxIntervaloMs };
