const Veiculo = require('../models/Veiculo');
const Cliente = require('../models/Cliente');
const { identificadorValido } = require('../services/acessoVeiculo');

exports.listar = async (req, res) => {
  try {
    const veiculos = await Veiculo.find({})
      .populate('clienteId', 'nome')
      .populate('clientesEspelhados', 'nome')
      .sort({ placa: 1 });
    const empresas = await Cliente.find({ ativo: true }).select('nome').sort({ nome: 1 });
    return res.json({ sucesso: true, dados: { veiculos, empresas } });
  } catch (err) {
    return res
      .status(500)
      .json({ sucesso: false, mensagem: 'Não foi possível carregar os espelhamentos.' });
  }
};

const alterar = (revogar) => async (req, res) => {
  try {
    const { veiculoId, clienteId } = req.params;
    if (!identificadorValido(veiculoId) || !identificadorValido(clienteId))
      return res.status(400).json({ sucesso: false, mensagem: 'Veículo ou empresa inválidos.' });
    const veiculo = await Veiculo.findById(veiculoId);
    if (!veiculo)
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado.' });
    if (String(veiculo.clienteId) === clienteId)
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'A empresa proprietária já possui acesso ao veículo.' });
    if (!revogar && !(await Cliente.findOne({ _id: clienteId, ativo: true })))
      return res.status(404).json({ sucesso: false, mensagem: 'Empresa ativa não encontrada.' });
    await Veiculo.updateOne(
      { _id: veiculoId },
      revogar
        ? { $pull: { clientesEspelhados: clienteId } }
        : { $addToSet: { clientesEspelhados: clienteId } }
    );
    return res.json({
      sucesso: true,
      mensagem: revogar ? 'Espelhamento revogado.' : 'Espelhamento autorizado.',
    });
  } catch (err) {
    return res
      .status(500)
      .json({ sucesso: false, mensagem: 'Não foi possível atualizar o espelhamento.' });
  }
};
exports.autorizar = alterar(false);
exports.revogar = alterar(true);
