const Veiculo = require('../models/Veiculo');

const validarVeiculo = ({ placa, marca, modelo, ano, nomeCliente }) => {
  const erros = [];

  if (!placa || !placa.trim()) erros.push('A placa é obrigatória.');
  if (!marca || !marca.trim()) erros.push('A marca é obrigatória.');
  if (!modelo || !modelo.trim()) erros.push('O modelo é obrigatório.');
  if (!ano || Number.isNaN(Number(ano))) erros.push('O ano é obrigatório e deve ser numérico.');
  if (!nomeCliente || !nomeCliente.trim()) erros.push('O nome do cliente é obrigatório.');

  return erros;
};

exports.cadastrarVeiculo = async (req, res) => {
  try {
    const payload = {
      ...req.body,
      placa: req.body.placa?.toUpperCase?.().trim(),
      clienteId: req.user.clienteId,
    };

    const erros = validarVeiculo(payload);
    if (erros.length > 0) {
      return res.status(400).json({ sucesso: false, erros });
    }

    const veiculo = await Veiculo.create(payload);
    res.status(201).json({ sucesso: true, dados: veiculo });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ sucesso: false, mensagem: 'Placa já cadastrada.' });
    }
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.listarVeiculos = async (req, res) => {
  try {
    const veiculos = await Veiculo.find({ clienteId: req.user.clienteId }).sort({
      dataCadastro: -1,
    });
    res.json({ sucesso: true, quantidade: veiculos.length, dados: veiculos });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.buscarPorPlaca = async (req, res) => {
  try {
    const placa = req.params.placa?.toUpperCase?.().trim();
    const veiculo = await Veiculo.findOne({ placa, clienteId: req.user.clienteId });
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado' });
    }
    res.json({ sucesso: true, dados: veiculo });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};
