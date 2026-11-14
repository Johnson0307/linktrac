const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const Manutencao = require('../models/Manutencao');
const { Registro, Notificacao } = require('./modelos');
const { obterConfig } = require('./configuracao');

const dia = 86400000;
const tiposRisco = ['velocidade', 'frenagem', 'aceleracao', 'curva', 'diagnostico',
  'camera_fadiga', 'camera_distracao', 'camera_celular', 'camera_cinto', 'camera_colisao'];
const agregado = (modelo, etapas) => modelo.aggregate(etapas).option({ maxTimeMS: 15000 });

async function gerarResumoSemanal(clienteId, agora = new Date()) {
  const inicio = new Date(agora - 7 * dia);
  const anterior = new Date(agora - 14 * dia);
  const veiculos = await Veiculo.find({
    clienteId, ativo: { $ne: false }, $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }],
  }).select('_id placa').lean();
  const ids = veiculos.map(v => v._id);
  const rotulos = new Map(veiculos.map(v => [String(v._id), v.placa]));
  const comPlaca = item => ({ ...item, placa: rotulos.get(String(item.veiculoId)) });
  const [config, alertas, planos, servicos] = await Promise.all([
    obterConfig(clienteId),
    Notificacao.find({ clienteId, veiculoId: { $in: ids }, simulado: { $ne: true },
      createdAt: { $gte: inicio, $lt: agora }, tipo: { $in: [...tiposRisco, 'combustivel', 'manutencao'] },
    }).select('veiculoId tipo createdAt mensagem').sort({ createdAt: -1 }).limit(2001).lean(),
    Registro.find({ clienteId, tipo: 'planos', 'dados.ativo': true,
      'dados.veiculoId': { $in: ids.map(String) }, 'dados.intervaloDias': { $gt: 0 },
    }).select('dados').limit(501).lean(),
    agregado(Manutencao, [
      { $match: { clienteId, veiculoId: { $in: ids }, dataServico: { $lte: agora } } },
      { $group: { _id: { veiculoId: '$veiculoId', servico: '$servico' }, ultima: { $max: '$dataServico' } } },
    ]),
  ]);
  const ociosidade = await agregado(Localizacao, [
    { $match: { veiculoId: { $in: ids }, fonte: { $ne: 'simulado' }, dataHora: { $gte: anterior, $lt: agora } } },
    { $setWindowFields: { partitionBy: '$veiculoId', sortBy: { dataHora: 1, _id: 1 },
      output: { anterior: { $shift: { by: -1, output: {
        dataHora: '$dataHora', velocidade: '$velocidade', ignicao: '$ignicao', status: '$status',
      } } } },
    } },
    { $set: { intervalo: { $subtract: ['$dataHora', '$anterior.dataHora'] } } },
    { $match: { ignicao: true, 'anterior.ignicao': true, status: { $ne: 'Sem sinal' },
      'anterior.status': { $ne: 'Sem sinal' }, velocidade: { $gte: 0, $lte: 3 },
      'anterior.velocidade': { $gte: 0, $lte: 3 }, intervalo: { $gt: 0, $lte: Math.min(config.ausenciaMinutos, 5) * 60000 },
    } },
    { $group: { _id: '$veiculoId',
      atualMs: { $sum: { $cond: [{ $gte: ['$dataHora', inicio] },
        { $subtract: ['$dataHora', { $max: ['$anterior.dataHora', inicio] }] }, 0] } },
      anteriorMs: { $sum: { $cond: [{ $lt: ['$anterior.dataHora', inicio] },
        { $subtract: [{ $min: ['$dataHora', inicio] }, '$anterior.dataHora'] }, 0] } },
    } },
  ]);
  const riscos = new Map();
  for (const a of alertas.slice(0, 2000)) {
    if (!tiposRisco.includes(a.tipo)) continue;
    const key = String(a.veiculoId);
    const item = riscos.get(key) || { veiculoId: a.veiculoId, quantidade: 0, ultimo: a };
    item.quantidade += 1;
    riscos.set(key, item);
  }
  const ultimaRevisao = new Map(servicos.map(s => [String(s._id.veiculoId) + ':' + s._id.servico, s.ultima]));
  const manutencoes = planos.slice(0, 500).map(({ dados: p }) => {
    const datas = [Date.parse(p.ultimaData), Number(ultimaRevisao.get(p.veiculoId + ':' + p.servico))];
    const data = Math.max(...datas.filter(Number.isFinite));
    return { veiculoId: p.veiculoId, servico: p.servico, venceEm: data + p.intervaloDias * dia };
  }).filter(p => Number.isFinite(p.venceEm) && p.venceEm <= agora.getTime() + 7 * dia)
    .sort((a, b) => a.venceEm - b.venceEm).slice(0, 5).map(p => comPlaca({ ...p, venceEm: new Date(p.venceEm) }));
  return {
    inicio, fim: agora, anterior, totalVeiculos: ids.length,
    ociosidade: ociosidade.filter(p => p.atualMs > 0).sort((a, b) => b.atualMs - a.atualMs).slice(0, 5)
      .map(p => comPlaca({ veiculoId: p._id, minutos: p.atualMs / 60000, minutosSemanaAnterior: p.anteriorMs / 60000 })),
    riscos: [...riscos.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5).map(comPlaca),
    manutencoes,
    alertasCombustivel: alertas.slice(0, 2000).filter(a => a.tipo === 'combustivel').slice(0, 5).map(comPlaca),
    alertasManutencao: alertas.slice(0, 2000).filter(a => a.tipo === 'manutencao').slice(0, 5).map(comPlaca),
    limitado: alertas.length > 2000 || planos.length > 500,
  };
}

module.exports = { gerarResumoSemanal };
