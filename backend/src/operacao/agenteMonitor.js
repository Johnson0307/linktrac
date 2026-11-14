const { Config, Analise } = require('./agenteModelos');
const Veiculo = require('../models/Veiculo');
const { executarAnalise } = require('./agenteServico');
const { notificar } = require('./automacoes');
let cursor = null,
  ocupado = false;
async function verificar() {
  if (ocupado) return;
  ocupado = true;
  try {
    let configs = await Config.find({
      monitorar: true,
      ...(cursor ? { _id: { $gt: cursor } } : {}),
    })
      .sort({ _id: 1 })
      .limit(50)
      .lean();
    if (!configs.length) {
      cursor = null;
      return;
    }
    for (const c of configs) {
      cursor = c._id;
      try {
        const v = await Veiculo.findOne({ _id: c.veiculoId, clienteId: c.clienteId }).lean();
        if (!v) continue;
        const anterior = await Analise.findOne({ clienteId: c.clienteId, veiculoId: c.veiculoId })
          .sort({ createdAt: -1 })
          .lean();
        if (anterior && Date.now() - +new Date(anterior.createdAt) < 300000) continue;
        const doc = await executarAnalise(v, 'Monitor automático Linktrac');
        for (const achado of doc.resultado.achados)
          if (!anterior?.resultado?.achados?.some((a) => a.codigo === achado.codigo))
            await notificar(c.clienteId, `assistente:${doc._id}:${achado.codigo}`, {
              veiculoId: v._id,
              tipo: 'assistente_manutencao',
              mensagem: `Assistente de manutenção: ${achado.titulo}. Consulte as evidências e solicite inspeção se necessário.`,
              simulado: doc.resultado.simulado,
            });
      } catch {
        console.error(
          'Assistente: veículo não analisado neste ciclo. Nova tentativa no próximo ciclo.'
        );
      }
    }
    if (configs.length < 50) cursor = null;
  } finally {
    ocupado = false;
  }
}
function iniciarMonitor() {
  const timer = setInterval(
    () => verificar().catch(() => console.error('Monitor de manutenção indisponível neste ciclo.')),
    300000
  );
  timer.unref();
  return timer;
}
module.exports = { verificar, iniciarMonitor };
