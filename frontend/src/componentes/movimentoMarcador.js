export function atualizarPosicaoMarcador(item, destino, suavizar) {
  cancelarMovimento(item);
  const { marcador, posicao: anterior } = item;
  item.posicao = destino;
  const origem = marcador.getLatLng();
  const alvo = [destino.latitude, destino.longitude];
  const deltaGps = Date.parse(destino.dataHora) - Date.parse(anterior?.dataHora);
  const distancia = origem.distanceTo(alvo);
  const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  if (!suavizar || reduzirMovimento || document.hidden || !anterior?.recente || !destino.recente ||
      !Number.isFinite(deltaGps) || deltaGps <= 0 || deltaGps > 60000 ||
      distancia < 2 || distancia > Math.min(1000, deltaGps * 0.07 + 15)) {
    marcador.setLatLng(alvo);
    return;
  }

  const duracao = Math.min(1400, Math.max(400, deltaGps / 5));
  let inicio;
  const animar = instante => {
    inicio ??= instante;
    const progresso = Math.min(1, (instante - inicio) / duracao);
    marcador.setLatLng(progresso === 1 ? alvo : [
      origem.lat + (destino.latitude - origem.lat) * progresso,
      origem.lng + (destino.longitude - origem.lng) * progresso,
    ]);
    item.quadro = progresso < 1 ? requestAnimationFrame(animar) : undefined;
  };
  item.quadro = requestAnimationFrame(animar);
}

export function cancelarMovimento(item) {
  if (item.quadro != null) cancelAnimationFrame(item.quadro);
  item.quadro = undefined;
}
