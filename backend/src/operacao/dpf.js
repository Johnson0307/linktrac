// Os limites de fuligem dependem do fabricante; não há limiar universal nem previsão de falha.
const codigosDpf = ['P2002', 'P2459', 'P2463', 'P246C'];
function avaliarDpf(telemetria = {}, config = {}) {
  const evidencias = [];
  const incluir = campo => { if (telemetria[campo] !== undefined) evidencias.push({ campo, valor: telemetria[campo] }); };
  ['dpfFuligemPct', 'dpfLuz', 'dpfRegeneracao', 'dpfRegeneracoesInterrompidas', 'odometroKm', 'horimetroHoras'].forEach(incluir);
  const dtcs = (telemetria.dtcs || []).filter(c => codigosDpf.includes(c));
  if (dtcs.length) evidencias.push({ campo: 'dtcs', valor: dtcs });
  const presente = ['dpfFuligemPct', 'dpfLuz', 'dpfRegeneracao', 'dpfRegeneracoesInterrompidas'].some(c => telemetria[c] !== undefined) || dtcs.length > 0;
  if (!presente) return { estado: 'sem_dados', motivos: [], evidencias: [] };
  const referencias = Number.isFinite(config.dpfObservarPct) && Number.isFinite(config.dpfInspecaoPct) && config.dpfObservarPct < config.dpfInspecaoPct;
  const motivos = [];
  if (telemetria.dpfLuz === true) motivos.push('Luz do DPF informada como acesa.');
  if (dtcs.length) motivos.push('Código de falha relacionado ao DPF recebido.');
  if (referencias && telemetria.dpfFuligemPct >= config.dpfInspecaoPct) motivos.push('Fuligem acima da referência de inspeção cadastrada para este veículo.');
  const inspecao = motivos.length > 0;
  if (telemetria.dpfRegeneracao === 'interrompida') motivos.push('O equipamento informou regeneração interrompida.');
  if (referencias && telemetria.dpfFuligemPct >= config.dpfObservarPct && !inspecao) motivos.push('Fuligem acima da referência de observação cadastrada.');
  return { estado: inspecao ? 'inspecao_recomendada' : motivos.length ? 'observar' : referencias ? 'sem_indicio_nos_criterios' : 'referencias_pendentes',
    motivos, evidencias, aviso: 'Conferir manual, sensor e avaliação técnica. Não executar regeneração forçada ou liberar o veículo com base somente nesta classificação.' };
}
module.exports = { avaliarDpf, codigosDpf };
