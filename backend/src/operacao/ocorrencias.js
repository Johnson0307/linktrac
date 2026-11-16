const router = require('express').Router();
const { randomUUID } = require('node:crypto');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { permite } = require('../services/acessosCliente');
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const { Notificacao } = require('./modelos');
const { notificar } = require('./automacoes');
const { tipoAlertaAlimentacao } = require('./avisosExternos');
const { tipoMovimentoSemIgnicao } = require('./movimentoSemIgnicao');
const { id } = require('./validacao');

const estados = ['aberta', 'em_atendimento', 'encerrada'];
const perfis = ['admin', 'gestor', 'operador'];
const dadosBasicos = '_id tipo veiculoId mensagem simulado ocorridoEm createdAt';
const responder = (res, dados) => res.json({ sucesso: true, dados });
const falha = (res, status, mensagem) => res.status(status).json({ sucesso: false, mensagem });
const tratar = acao => async (req, res) => {
  try {
    return await acao(req, res);
  } catch {
    return falha(res, 503, 'A central de monitoramento está temporariamente indisponível.');
  }
};
const nome = user => user.nome || 'Operador';
const mesmo = (a, b) => String(a) === String(b);
const filtroDaEmpresa = req => ({ clienteId: req.user.clienteId, 'ocorrencia.estado': { $exists: true } });
const podeEditar = user => adminDaLinktrac(user) || permite(user.acessos, 'operacao', true);
const veiculoDaEmpresa = (req, veiculoId) => ({ _id: veiculoId, clienteId: req.user.clienteId });

router.use(authorize(...perfis), (req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!adminDaLinktrac(req.user) && !permite(req.user.acessos, 'operacao', req.method !== 'GET')) {
    return falha(res, 403, 'Sua conta não tem acesso a esta ação na central.');
  }
  next();
});

router.get('/', tratar(async (req, res) => {
  const estado = req.query.estado ?? 'aberta';
  if (!estados.includes(estado)) return falha(res, 400, 'Estado da ocorrência inválido.');
  const grupos = await Notificacao.find({ ...filtroDaEmpresa(req), 'ocorrencia.estado': estado })
    .schemaLevelProjections(false).select(`${dadosBasicos} ocorrencia.estado ocorrencia.prioridade ocorrencia.responsavel`)
    .sort(estado === 'encerrada' ? { createdAt: -1, _id: -1 } : { 'ocorrencia.prioridade': 1, createdAt: 1, _id: 1 })
    .limit(101).lean();
  const eventos = grupos.slice(0, 100);
  const veiculos = await Veiculo.find({ clienteId: req.user.clienteId, _id: { $in: eventos.map(v => v.veiculoId).filter(Boolean) } })
    .select('placa').lean();
  const placas = new Map(veiculos.map(v => [String(v._id), v.placa]));
  return res.json({ sucesso: true, dados: eventos.map(({ ocorrencia, ...evento }) => ({
    ...evento, placa: placas.get(String(evento.veiculoId)),
    ocorrencia: { estado: ocorrencia.estado, prioridade: ocorrencia.prioridade, responsavel: ocorrencia.responsavel },
  })), limitado: grupos.length > 100, podeEditar: podeEditar(req.user) });
}));

router.get('/veiculos-teste', authorize('admin', 'gestor'), tratar(async (req, res) => {
  if (!podeEditar(req.user)) return falha(res, 403, 'Sua conta tem acesso de consulta.');
  const veiculos = await Veiculo.find({ clienteId: req.user.clienteId, ativo: { $ne: false } })
    .select('placa').sort({ placa: 1 }).limit(500).lean();
  return responder(res, veiculos);
}));

router.post('/simular', authorize('admin', 'gestor'), tratar(async (req, res) => {
  const tipo = req.body?.tipo ?? tipoAlertaAlimentacao;
  if (![tipoAlertaAlimentacao, tipoMovimentoSemIgnicao].includes(tipo)) return falha(res, 400, 'Selecione um tipo de alerta.');
  if (!id(req.body?.veiculoId)) return falha(res, 400, 'Selecione um veículo.');
  const veiculo = await Veiculo.findOne({ ...veiculoDaEmpresa(req, req.body.veiculoId), ativo: { $ne: false } }).select('placa').lean();
  if (!veiculo) return falha(res, 404, 'Veículo não encontrado.');
  await notificar(req.user.clienteId, `simulacao-central:${randomUUID()}`, {
    veiculoId: veiculo._id, mensagem: tipo === tipoMovimentoSemIgnicao
      ? `Simulação de movimento com a ignição desligada no veículo ${veiculo.placa}.`
      : `Simulação de perda de alimentação no veículo ${veiculo.placa}.`,
    tipo, simulado: true, ocorridoEm: new Date(),
  });
  return res.status(201).json({ sucesso: true });
}));

router.get('/:id', tratar(async (req, res) => {
  if (!id(req.params.id)) return falha(res, 404, 'Ocorrência não encontrada.');
  const evento = await Notificacao.findOne({ ...filtroDaEmpresa(req), _id: req.params.id })
    .select(`${dadosBasicos} +ocorrencia`).lean();
  if (!evento) return falha(res, 404, 'Ocorrência não encontrada.');
  const veiculo = evento.veiculoId && await Veiculo.findOne(veiculoDaEmpresa(req, evento.veiculoId))
    .select('placa nomeCliente telefone').lean();
  const posicao = veiculo && !evento.simulado ? await Localizacao.findOne({
    veiculoId: veiculo._id, fonte: { $ne: 'simulado' },
  }).select('latitude longitude dataHora velocidade').sort({ dataHora: -1, _id: -1 }).lean() : null;
  return responder(res, { ...evento, veiculo, posicao });
}));

router.patch('/:id', tratar(async (req, res) => {
  if (!id(req.params.id)) return falha(res, 404, 'Ocorrência não encontrada.');
  const { acao, texto, revisao } = req.body || {};
  if (!['assumir', 'anotar', 'encerrar'].includes(acao) || !Number.isSafeInteger(revisao) || revisao < 0 ||
      (acao !== 'assumir' && (typeof texto !== 'string' || !texto.trim() || texto.length > 500))) {
    return falha(res, 400, 'Confira a ação e informe uma anotação de até 500 caracteres.');
  }
  const filtro = { ...filtroDaEmpresa(req), _id: req.params.id };
  const atual = await Notificacao.findOne(filtro).select('+ocorrencia').lean();
  if (!atual) return falha(res, 404, 'Ocorrência não encontrada.');
  const { estado, responsavel } = atual.ocorrencia;
  if (acao !== 'assumir' && !mesmo(responsavel?.id, req.user.id) && req.user.role === 'operador') {
    return falha(res, 403, 'Somente o responsável ou um gestor pode atualizar o atendimento.');
  }
  if (atual.ocorrencia.revisao !== revisao || estado !== (acao === 'assumir' ? 'aberta' : 'em_atendimento')) {
    return falha(res, 409, 'A ocorrência mudou. Atualize a ficha para continuar.');
  }
  const alteracao = acao === 'anotar' ? {} : { $set: acao === 'assumir' ? {
    'ocorrencia.estado': 'em_atendimento', 'ocorrencia.responsavel': { id: req.user.id, nome: nome(req.user) },
  } : { 'ocorrencia.estado': 'encerrada' } };
  const resultado = await Notificacao.updateOne({ ...filtro, 'ocorrencia.revisao': revisao }, {
    ...alteracao, $inc: { 'ocorrencia.revisao': 1 },
    $push: { 'ocorrencia.historico': { tipo: acao, por: req.user.id, nome: nome(req.user), em: new Date(),
      ...(acao !== 'assumir' ? { texto: texto.trim() } : {}) } },
  });
  if (!resultado.matchedCount) return falha(res, 409, 'A ocorrência mudou. Atualize a ficha para continuar.');
  return res.json({ sucesso: true });
}));

module.exports = router;
