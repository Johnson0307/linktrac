const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { id } = require('./validacao');
const { validarConfig } = require('./agenteRegras');
const { Config, Analise, Solicitacao } = require('./agenteModelos');

const Veiculo = require('../models/Veiculo');

const ia = require('./agenteIA');
const recusar = (mensagem, status = 400) => {
  throw Object.assign(new Error(mensagem), { status });
};
const falha = (res, e) =>
  res
    .status(e.code === 11000 ? 409 : e.status || 503)
    .json({
      sucesso: false,
      mensagem:
        e.code === 11000
          ? 'Já existe uma solicitação aberta para este achado.'
          : e.status
            ? e.message
            : 'Assistente temporariamente indisponível. A análise anterior foi preservada.',
    });
async function proprio(req, veiculoId) {
  if (!id(veiculoId)) recusar('Veículo inválido.');
  const v = await Veiculo.findOne({ _id: veiculoId, clienteId: req.user.clienteId }).lean();
  if (!v) recusar('Veículo da empresa não encontrado.', 404);
  return v;
}
router.use(authenticate, authorize('admin', 'gestor'));
router.get('/status', (req, res) =>
  res.json({
    sucesso: true,
    iaConfigurada: ia.configurado(),
    modo: 'Regras técnicas e recorrências; IA opcional sob solicitação.',
    limites: { dias: 7, leiturasPorFonte: 2000 },
    comandosFisicos: false,
  })
);
router.get('/solicitacoes', async (req, res) => {
  try {
    const dados = await Solicitacao.find({ clienteId: req.user.clienteId })
      .sort({ createdAt: -1 })
      .limit(501)
      .lean();
    res.json({ sucesso: true, dados: dados.slice(0, 500), limitado: dados.length > 500 });
  } catch (e) {
    falha(res, e);
  }
});
router.put('/solicitacoes/:id', async (req, res) => {
  try {
    if (!id(req.params.id)) recusar('Solicitação inválida.');
    const { status, parecer } = req.body || {};
    if (
      !['aprovada', 'concluida', 'descartada'].includes(status) ||
      typeof parecer !== 'string' ||
      parecer.trim().length < 10 ||
      parecer.length > 1000
    )
      recusar('Escolha uma decisão e informe um parecer de 10 a 1.000 caracteres.');
    const atual = await Solicitacao.findOne({
      _id: req.params.id,
      clienteId: req.user.clienteId,
    }).lean();
    if (!atual) recusar('Solicitação não encontrada.', 404);
    if (!(
      (atual.status === 'pendente' && ['aprovada', 'descartada'].includes(status)) ||
      (atual.status === 'aprovada' && ['concluida', 'descartada'].includes(status))
    ))
      recusar('Transição não permitida. Atualize a lista.', 409);
    const doc = await Solicitacao.findOneAndUpdate(
      { _id: atual._id, clienteId: req.user.clienteId, status: atual.status },
      {
        $set: {
          status,
          parecer: parecer.trim(),
          decididoPor: req.user.email,
          aberta: status === 'aprovada',
        },
        $push: {
          historico: {
            status,
            parecer: parecer.trim(),
            usuario: req.user.email,
            dataHora: new Date(),
          },
        },
      },
      { new: true, runValidators: true }
    );
    if (!doc) recusar('A solicitação foi atualizada por outra pessoa.', 409);
    res.json({ sucesso: true, dados: doc });
  } catch (e) {
    falha(res, e);
  }
});
router.get('/:veiculoId', async (req, res) => {
  try {
    await proprio(req, req.params.veiculoId);
    const filtro = { clienteId: req.user.clienteId, veiculoId: req.params.veiculoId };
    const [config, analise] = await Promise.all([
      Config.findOne(filtro).lean(),
      Analise.findOne(filtro).sort({ createdAt: -1 }).lean(),
    ]);
    res.json({
      sucesso: true,
      config: config
        ? {
            temperaturaMotorMax: config.temperaturaMotorMax ?? null,
            tensaoMinima: config.tensaoMinima ?? null,
            dpfObservarPct: config.dpfObservarPct ?? null,
            dpfInspecaoPct: config.dpfInspecaoPct ?? null,
            monitorar: config.monitorar === true,
          }
        : {},
      analise,
    });
  } catch (e) {
    falha(res, e);
  }
});
router.put('/:veiculoId/config', async (req, res) => {
  try {
    await proprio(req, req.params.veiculoId);
    const { dados, erro } = validarConfig(req.body);
    if (erro) recusar(erro);
    await Config.init();
    await Config.findOneAndUpdate(
      { clienteId: req.user.clienteId, veiculoId: req.params.veiculoId },
      { $set: dados },
      { upsert: true, runValidators: true }
    );
    res.json({ sucesso: true, dados });
  } catch (e) {
    falha(res, e);
  }
});
router.post('/:veiculoId/analisar', async (req, res) => {
  try {
    const veiculo = await proprio(req, req.params.veiculoId);
    const doc = await require('./agenteServico').executarAnalise(veiculo, req.user.email);
    res.status(201).json({ sucesso: true, dados: doc });
  } catch (e) {
    falha(res, e);
  }
});
router.post('/analises/:id/solicitacoes', async (req, res) => {
  try {
    if (!id(req.params.id)) recusar('Análise inválida.');
    const doc = await Analise.findOne({ _id: req.params.id, clienteId: req.user.clienteId }).lean();
    if (!doc) recusar('Análise não encontrada.', 404);
    await proprio(req, String(doc.veiculoId));
    if (Date.now() - +new Date(doc.createdAt) > 86400000)
      recusar('A análise tem mais de 24 horas. Execute uma nova análise.', 409);
    const achado = doc.resultado.achados.find((a) => a.codigo === req.body?.codigo);
    if (!achado) recusar('Achado não encontrado.');
    await Solicitacao.init();
    const dados = await Solicitacao.create({
      clienteId: req.user.clienteId,
      veiculoId: doc.veiculoId,
      analiseId: doc._id,
      codigo: achado.codigo,
      titulo: achado.titulo,
      evidencias: achado.evidencias,
      recomendacao: achado.recomendacao,
      simulado: doc.resultado.simulado,
      criadoPor: req.user.email,
    });
    res.status(201).json({ sucesso: true, dados });
  } catch (e) {
    falha(res, e);
  }
});
const chamadas = new Map();
router.post('/analises/:id/interpretar', async (req, res) => {
  try {
    if (!id(req.params.id)) recusar('Análise inválida.');
    if (!ia.configurado())
      recusar('Interpretação por IA ainda não configurada. A análise técnica já funciona.', 409);
    const doc = await Analise.findOne({ _id: req.params.id, clienteId: req.user.clienteId }).lean();
    if (!doc) recusar('Análise não encontrada.', 404);
    if (doc.resultado.ia) return res.json({ sucesso: true, dados: doc.resultado.ia });
    const key = String(req.user.clienteId),
      agora = Date.now(),
      limite = chamadas.get(key);
    if (limite && agora - limite.inicio < 60000 && limite.total >= 5)
      recusar('Aguarde um minuto antes de solicitar outra interpretação.', 429);
    if (!limite || agora - limite.inicio >= 60000) chamadas.set(key, { inicio: agora, total: 1 });
    else limite.total++;
    if (chamadas.size > 10000) chamadas.delete(chamadas.keys().next().value);
    const interpretacao = await ia.interpretar(doc.resultado);
    await Analise.updateOne(
      { _id: doc._id, clienteId: req.user.clienteId },
      { $set: { 'resultado.ia': interpretacao } }
    );
    res.json({ sucesso: true, dados: interpretacao });
  } catch (e) {
    falha(res, e);
  }
});
module.exports = { router, proprio };
