const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const Manutencao = require('../models/Manutencao');
const ReferenciaMapa = require('../models/ReferenciaMapa');
const { filtroAcesso } = require('../services/acessoVeiculo');
const { simulado, resumirPainel } = require('../services/resumoPainel');
const { permite } = require('../services/acessosCliente');
const { obterBase, localizarVia } = require('../operacao/fiscalizacao');
exports.consultarPainel = async (req, res) => {
  try {
    const veiculos = await Veiculo.find(filtroAcesso(req.user.clienteId)).select('_id placa clienteId nomeCliente marca modelo iconeMapa').lean();
    const reais = veiculos.filter((v) => !simulado(v));
    const ids = reais.map((v) => v._id);
    const proprios = reais.filter((v) => String(v.clienteId) === String(req.user.clienteId)).map((v) => v._id);
    const [grupos, servicos, referenciasMapa] = await Promise.all([
      ids.length ? Localizacao.aggregate([
        { $match: { veiculoId: { $in: ids }, fonte: { $ne: 'simulado' } } },
        { $sort: { veiculoId: 1, dataHora: -1, _id: -1 } },
        { $group: { _id: '$veiculoId', posicao: { $first: {
          veiculoId: '$veiculoId', latitude: '$latitude', longitude: '$longitude', velocidade: '$velocidade',
          dataHora: '$dataHora', status: '$status', fonte: '$fonte',
        } } } },
      ]) : [],
      proprios.length && permite(req.user.acessos, 'manutencao') ? Manutencao.countDocuments({ clienteId: req.user.clienteId, veiculoId: { $in: proprios } }) : 0,
      ReferenciaMapa.find({ clienteId: req.user.clienteId }).select('nome latitude longitude iconeMapa').lean(),
    ]);
    const config = await require('../operacao/configuracao').obterConfig(req.user.clienteId);
    const resumo = resumirPainel(veiculos, grupos.map((g) => g.posicao), servicos, new Date(), config);
    const base = grupos.length ? await obterBase() : null;
    if (base) {
      for (const veiculo of resumo.veiculosMapa) {
        const via = localizarVia(base, veiculo.posicao);
        if (via) veiculo.posicao.via = via;
      }
    }
    res.set?.('Cache-Control', 'private, no-store');
    return res.json({ sucesso: true, dados: {
      ...resumo, referenciasMapa,
    } });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível carregar o painel. Tente novamente.' });
  }
};
