const Veiculo = require('../models/Veiculo');

exports.cadastrarVeiculo = async (req, res) => {
  try {
    const veiculo = await Veiculo.create(req.body);
    res.status(201).json({ sucesso: true, dados: veiculo });
  } catch (err) {
    res.status(400).json({ sucesso: false, erro: err.message });
  }
};

exports.listarVeiculos = async (req, res) => {
  try {
    const veiculos = await Veiculo.find().sort({ dataCadastro: -1 });
    res.json({ sucesso: true, quantidade: veiculos.length, dados: veiculos });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.buscarPorPlaca = async (req, res) => {
  try {
    const veiculo = await Veiculo.findOne({ placa: req.params.placa.toUpperCase() });
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado' });
    }
    res.json({ sucesso: true, dados: veiculo });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};
