exports.calcularEventos = (posicoes, agora = new Date(), config = {}) => {
  const limiteVelocidade = config.limiteVelocidade ?? 80;
  const ausenciaComunicacaoMinutos = config.ausenciaMinutos ?? 5;
  const alertas = [];
  const ignicao = [];
  let anterior = null;
  for (const p of posicoes) {
    if (Number.isFinite(p.velocidade) && p.velocidade > limiteVelocidade)
      alertas.push({ tipo: `Velocidade acima de ${limiteVelocidade} km/h`, dataHora: p.dataHora, detalhe: `${p.velocidade} km/h`, simulado: p.fonte === 'simulado' });
    const intervalo = anterior ? Date.parse(p.dataHora) - Date.parse(anterior.dataHora) : 0;
    if (anterior && intervalo > ausenciaComunicacaoMinutos * 60 * 1000)
      alertas.push({ tipo: 'Intervalo sem comunicação', dataHora: p.dataHora, detalhe: `${Math.round(intervalo / 60000)} minutos entre posições`, simulado: p.fonte === 'simulado' });
    if (typeof p.ignicao === 'boolean') {
      const transicao = anterior && typeof anterior.ignicao === 'boolean' && intervalo <= ausenciaComunicacaoMinutos * 60 * 1000 && intervalo > 0;
      if (!transicao || anterior.ignicao !== p.ignicao)
        ignicao.push({ dataHora: p.dataHora, ligada: p.ignicao, tipo: transicao ? 'Mudança observada' : 'Estado observado', simulado: p.fonte === 'simulado' });
    }
    anterior = p;
  }
  const ultima = posicoes.at(-1);
  if (ultima && agora - new Date(ultima.dataHora) > ausenciaComunicacaoMinutos * 60 * 1000)
    alertas.push({ tipo: 'Última posição desatualizada', dataHora: ultima.dataHora, detalhe: `Mais de ${ausenciaComunicacaoMinutos} minutos sem posição posterior no histórico consultado.`, simulado: ultima.fonte === 'simulado' });
  return { alertas, ignicao, limiteVelocidade, ausenciaComunicacaoMinutos };
};
