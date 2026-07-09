exports.definirStatus = (velocidade) => {
  if (velocidade > 5) return 'Em movimento';
  if (velocidade >= 0) return 'Parado';
  return 'Sem sinal';
};

exports.formatarCoordenadas = (lat, lon) => {
  return `${lat.toFixed(6)} , ${lon.toFixed(6)}`;
};
