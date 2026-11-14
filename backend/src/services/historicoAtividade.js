const LIMITE_INTERVALO_MS = 5 * 60 * 1000;
const radianos = (valor) => valor * Math.PI / 180;
const coordenadaValida = (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;
const amostraValida = (p) => coordenadaValida(p) && p.status !== 'Sem sinal' &&
  Number.isFinite(p.velocidade) && p.velocidade >= 0 && p.velocidade <= 300;
const distanciaKm = (a, b) => {
  const dLat = radianos(b.latitude - a.latitude);
  const dLon = radianos(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(radianos(a.latitude)) * Math.cos(radianos(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, h)));
};
const ponto = (p) => ({ latitude: p.latitude, longitude: p.longitude, endereco: p.endereco || '' });

// Classifica apenas intervalos observados. Não extrapola além da última amostra.
const resumirAtividade = (posicoes) => {
  const trechos = [];
  let atual = null;
  let intervalosDesconhecidos = 0;
  let tempoDesconhecidoSegundos = 0;
  for (let i = 1; i < posicoes.length; i++) {
    const anterior = posicoes[i - 1];
    const seguinte = posicoes[i];
    const dt = Date.parse(seguinte.dataHora) - Date.parse(anterior.dataHora);
    if (!Number.isFinite(dt) || dt <= 0) { atual = null; continue; }
    if (dt > LIMITE_INTERVALO_MS || !amostraValida(anterior) || !amostraValida(seguinte)) {
      intervalosDesconhecidos++;
      tempoDesconhecidoSegundos += dt / 1000;
      atual = null;
      continue;
    }
    const tipo = anterior.velocidade > 5 ? 'viagem' : 'parada';
    if (!atual || atual.tipo !== tipo) {
      atual = { tipo, inicio: anterior.dataHora, fim: seguinte.dataHora, duracaoSegundos: 0,
        distanciaKm: 0, velocidadeMaxima: 0, origem: ponto(anterior), destino: ponto(seguinte) };
      trechos.push(atual);
    }
    atual.fim = seguinte.dataHora;
    atual.destino = ponto(seguinte);
    atual.duracaoSegundos += dt / 1000;
    atual.velocidadeMaxima = Math.max(atual.velocidadeMaxima, anterior.velocidade);
    if (tipo === 'viagem') atual.distanciaKm += distanciaKm(anterior, seguinte);
  }
  const viagens = trechos.filter((t) => t.tipo === 'viagem');
  const paradas = trechos.filter((t) => t.tipo === 'parada');
  return {
    estimado: true, limiteIntervaloSegundos: LIMITE_INTERVALO_MS / 1000,
    intervalosDesconhecidos, tempoDesconhecidoSegundos,
    resumo: { viagens: viagens.length, paradas: paradas.length,
      tempoMovimentoSegundos: viagens.reduce((s, t) => s + t.duracaoSegundos, 0),
      tempoParadoSegundos: paradas.reduce((s, t) => s + t.duracaoSegundos, 0),
      distanciaKm: viagens.reduce((s, t) => s + t.distanciaKm, 0) },
    trechos,
  };
};
module.exports = { resumirAtividade };
