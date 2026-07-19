const Localizacao = require('../models/Localizacao');
const Veiculo = require('../models/Veiculo');
const { definirStatus, formatarCoordenadas } = require('../services/rastreamentoService');

exports.atualizarPosicao = async (req, res) => {
  try {
    const { placa, latitude, longitude, velocidade, endereco } = req.body;
    const veiculo = await Veiculo.findOne({ placa: placa?.toUpperCase?.() });

    if (!veiculo) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não cadastrado' });
    }

    const payload = {
      veiculoId: veiculo._id,
      latitude: Number(latitude),
      longitude: Number(longitude),
      velocidade: Number(velocidade) || 0,
      endereco,
      status: definirStatus(Number(velocidade)),
    };

    if (Number.isNaN(payload.latitude) || Number.isNaN(payload.longitude)) {
      return res
        .status(400)
        .json({ sucesso: false, mensagem: 'Latitude e longitude válidas são obrigatórias.' });
    }

    const novaPosicao = await Localizacao.create(payload);

    res.status(201).json({ sucesso: true, dados: novaPosicao });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.consultarUltimaPosicao = async (req, res) => {
  try {
    const placa = req.params.placa?.toUpperCase?.();
    const veiculo = await Veiculo.findOne({ placa, clienteId: req.user.clienteId });
    if (!veiculo) {
      return res.status(404).json({ sucesso: false, mensagem: 'Veículo não encontrado' });
    }

    const ultimaPosicao = await Localizacao.findOne({ veiculoId: veiculo._id })
      .sort({ dataHora: -1 })
      .lean();

    if (!ultimaPosicao) {
      return res
        .status(404)
        .json({ sucesso: false, mensagem: 'Nenhuma posição registrada para este veículo' });
    }

    const localizacao = {
      ...ultimaPosicao,
      coordenadas: formatarCoordenadas(ultimaPosicao.latitude, ultimaPosicao.longitude),
    };

    res.json({
      sucesso: true,
      veiculo: {
        placa: veiculo.placa,
        marca: veiculo.marca,
        modelo: veiculo.modelo,
        cliente: veiculo.nomeCliente,
      },
      localizacao,
    });
  } catch (err) {
    res.status(500).json({ sucesso: false, erro: err.message });
  }
};
