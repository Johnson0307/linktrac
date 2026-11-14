const { analisar } = require('./agenteRegras');
const { Config, Analise } = require('./agenteModelos');
const { Registro, Amostra } = require('./modelos');
const Localizacao = require('../models/Localizacao');
const Manutencao = require('../models/Manutencao');
async function executarAnalise(veiculo, autor) {
  const filtro = { clienteId: veiculo.clienteId, veiculoId: veiculo._id };
  const agora = new Date();
  const periodo = {
    veiculoId: veiculo._id,
    dataHora: { $gte: new Date(+agora - 7 * 86400000), $lte: agora },
  };
  const [gps, sensores, planos, servicos, config] = await Promise.all([
    Localizacao.find({ ...periodo, telemetria: { $exists: true } })
      .select('dataHora telemetria ignicao')
      .sort({ dataHora: -1 })
      .limit(2001)
      .lean(),
    Amostra.find({ ...periodo, clienteId: veiculo.clienteId })
      .select('dataHora telemetria ignicao')
      .sort({ dataHora: -1 })
      .limit(2001)
      .lean(),
    Registro.find({
      clienteId: veiculo.clienteId,
      tipo: 'planos',
      'dados.veiculoId': String(veiculo._id),
      'dados.ativo': true,
    })
      .limit(501)
      .lean(),
    Manutencao.find(filtro).sort({ dataServico: -1 }).limit(501).lean(),
    Config.findOne(filtro).lean(),
  ]);
  const resultado = analisar({
    leituras: [...gps.slice(0, 2000), ...sensores.slice(0, 2000)],
    planos: planos.slice(0, 500),
    servicos: servicos.slice(0, 500),
    config: config || {},
    agora,
    limitado:
      gps.length > 2000 || sensores.length > 2000 || planos.length > 500 || servicos.length > 500,
  });
  resultado.simulado = veiculo.marca === 'TESTE' && veiculo.modelo === 'SIMULACAO';
  const doc = await Analise.create({ ...filtro, resultado, solicitadoPor: autor });
  return doc;
}
module.exports = { executarAnalise };
