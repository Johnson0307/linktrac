const resumirFinanceiro = (abastecimentos, servicos, leituras) => {
  const combustivelCentavos = abastecimentos.reduce((s, r) => s + Math.round(r.dados.valorReais * 100), 0);
  const manutencaoCentavos = servicos.reduce((s, r) => s + r.custoCentavos, 0);
  const litros = abastecimentos.reduce((s, r) => s + r.dados.litros, 0);
  const porVeiculo = new Map();
  for (const p of [...leituras].sort((a, b) => new Date(a.dataHora) - new Date(b.dataHora))) {
    const odo = p.telemetria?.odometroKm; if (!Number.isFinite(odo)) continue;
    const key = String(p.veiculoId); const r = porVeiculo.get(key) || { inicio: odo, ultimo: odo, amostras: 0, regressao: false };
    if (odo < r.ultimo) r.regressao = true;
    r.ultimo = odo; r.amostras++; porVeiculo.set(key, r);
  }
  const comBase = new Set();
  let distanciaObservadaKm = 0; let veiculosComBase = 0; let veiculosSemBase = 0;
  for (const [key, r] of porVeiculo.entries()) {
    if (r.regressao || r.amostras < 2) { veiculosSemBase++; continue; }
    distanciaObservadaKm += r.ultimo - r.inicio; veiculosComBase++; comBase.add(key);
  }
  const custoSemBase = [...abastecimentos.map(r => r.dados.veiculoId), ...servicos.map(r => r.veiculoId)].filter(Boolean).some(v => !comBase.has(String(v)));
  const custoTotalCentavos = combustivelCentavos + manutencaoCentavos;
  return { combustivelCentavos, manutencaoCentavos, custoTotalCentavos, litros, distanciaObservadaKm, veiculosComBase, veiculosSemBase,
    custoPorKmReais: distanciaObservadaKm > 0 && !custoSemBase ? custoTotalCentavos / 100 / distanciaObservadaKm : null,
    precoMedioLitroReais: litros > 0 ? combustivelCentavos / 100 / litros : null };
};
module.exports = { resumirFinanceiro };
