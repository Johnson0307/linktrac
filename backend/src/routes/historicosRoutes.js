const router = require('express').Router();
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const Manutencao = require('../models/Manutencao');
const Acao = require('../models/AcaoUsuario');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { identificadorValido, filtroAcesso } = require('../services/acessoVeiculo');
const { calcularEventos } = require('../services/eventosHistorico');
const { consultarHistorico } = require('../services/historicoArquivo');
router.use(authenticate);
router.get('/acoes', authorize('admin', 'gestor'), async (req, res) => {
  try {
    const dados = await Acao.find({ clienteId: req.user.clienteId }).sort({ dataHora: -1, _id: -1 }).limit(501).lean();
    return res.json({ sucesso: true, dados: dados.slice(0, 500), limitado: dados.length > 500 });
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Auditoria indisponível.' }); }
});
router.use('/:veiculoId', async (req, res, next) => {
  try {
    if (!identificadorValido(req.params.veiculoId)) return res.status(400).json({ sucesso: false, mensagem: 'Veículo inválido.' });
    const veiculo = await Veiculo.findOne({ _id: req.params.veiculoId, ...filtroAcesso(req.user.clienteId) });
    if (!veiculo) return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado.' });
    req.veiculoHistorico = veiculo;
    next();
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível verificar o veículo.' }); }
});
router.get('/:veiculoId/eventos', async (req, res) => {
  try {
    const pontos = await consultarHistorico(Localizacao, { veiculoId: req.veiculoHistorico._id }, { limite: 501 });
    const config = await require('../operacao/configuracao').obterConfig(req.user.clienteId);
    const eventos = calcularEventos(pontos.slice(0, 500).reverse(), new Date(), config);
    const ordenados = pontos.slice(0, 500).reverse();
    for (let i = 0; i < ordenados.length; i++) {
      const p = ordenados[i];
      const extras = require('../operacao/telemetria').eventosTelemetria(p, ordenados[i - 1], config).filter((e) => e.tipo !== 'velocidade');
      eventos.alertas.push(...extras.map((e) => ({ tipo: e.tipo, dataHora: p.dataHora, detalhe: e.mensagem, simulado: p.fonte === 'simulado' })));
    }
    return res.json({ sucesso: true, ...eventos, limitado: pontos.length > 500, posicoes: Math.min(pontos.length, 500) });
  } catch (e) { return res.status(503).json({ sucesso: false, mensagem: e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL' ? e.message : 'Eventos indisponíveis.' }); }
});
router.use('/:veiculoId/manutencoes', (req, res, next) => {
  if (String(req.veiculoHistorico.clienteId) !== String(req.user.clienteId))
    return res.status(403).json({ sucesso: false, mensagem: 'Manutenção é restrita à empresa proprietária.' });
  next();
});
router.get('/:veiculoId/manutencoes', async (req, res) => {
  try {
    const dados = await Manutencao.find({ veiculoId: req.veiculoHistorico._id, clienteId: req.user.clienteId }).sort({ dataServico: -1, _id: -1 }).limit(501).lean();
    return res.json({ sucesso: true, dados: dados.slice(0, 500), limitado: dados.length > 500 });
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Manutenções indisponíveis.' }); }
});
const dataValida = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
router.post('/:veiculoId/manutencoes', authorize('admin', 'gestor'), async (req, res) => {
  const b = req.body || {};
  if (typeof b.servico !== 'string' || !b.servico.trim() || b.servico.length > 200 || !dataValida(b.dataServico) ||
    !Number.isSafeInteger(b.custoCentavos) || b.custoCentavos < 0 || !Number.isSafeInteger(b.quilometragem) || b.quilometragem < 0 ||
    (b.proximaData && (!dataValida(b.proximaData) || b.proximaData < b.dataServico)) ||
    (b.proximaQuilometragem != null && (!Number.isSafeInteger(b.proximaQuilometragem) || b.proximaQuilometragem <= b.quilometragem)))
    return res.status(400).json({ sucesso: false, mensagem: 'Confira serviço, datas, custo e quilometragens. A próxima revisão deve ser posterior ao serviço.' });
  try {
    const dados = await Manutencao.create({ clienteId: req.user.clienteId, veiculoId: req.veiculoHistorico._id,
      servico: b.servico.trim(), dataServico: b.dataServico, custoCentavos: b.custoCentavos, quilometragem: b.quilometragem,
      proximaData: b.proximaData || undefined, proximaQuilometragem: b.proximaQuilometragem ?? undefined });
    return res.status(201).json({ sucesso: true, dados });
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível registrar a manutenção.' }); }
});
module.exports = router;
