const Localizacao = require('../models/Localizacao');
const Veiculo = require('../models/Veiculo');
const { definirStatus } = require('../services/rastreamentoService');

exports.atualizarPosicao = async (req, res) => {
  try {
    const { placa, latitude, longitude, velocidade, endereco } = req.body;
    const veiculo = await Veiculo.findOne({ placa: placa.toUpperCase() });

    if (!veiculo) {
      return res.status(404).json({ mensagem: 'Veículo não cadastrado' });
    }

    const novaPosicao = await Localizacao.create({
      veiculoId: veiculo._id,
      latitude,
      longitude,
      velocidade,
      endereco,
      status: definirStatus(velocidade),
    });

    res.status(201).json({ sucesso: true, dados: novaPosicao });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};

exports.consultarUltimaPosicao = async (req, res) => {
  try {
    const veiculo = await Veiculo.findOne({ placa: req.params.placa.toUpperCase() });
    if (!veiculo) {
      return res.status(404).json({ mensagem: 'Veículo não encontrado' });
    }

    const ultimaPosicao = await Localizacao.findOne({ veiculoId: veiculo._id }).sort({
      dataHora: -1,
    });

    res.json({
      sucesso: true,
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        cliente: veiculo.nomeCliente,
      },
      localizacao: ultimaPosicao || null,
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
};
