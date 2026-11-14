exports.definirStatus = (velocidade) => {
  // velocidade null indica telemetria ausente/ inválida
  if (velocidade === null || velocidade === undefined || !Number.isFinite(velocidade)) {
    return 'Sem sinal';
  }

  if (velocidade > 5) return 'Em movimento';
  if (velocidade >= 0) return 'Parado';

  // caso chegue negativo (por regra/integração), considera sem sinal
  return 'Sem sinal';
};

exports.formatarCoordenadas = (lat, lon) => {
  return `${lat.toFixed(6)} , ${lon.toFixed(6)}`;
};
