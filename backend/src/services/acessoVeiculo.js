const mongoose = require('mongoose');

const filtroAcesso = (clienteId) => ({
  $or: [{ clienteId }, { clientesEspelhados: clienteId }],
});

const filtroConsulta = (req) => ({
  ...filtroAcesso(req.user.clienteId),
  placa: req.params.placa.toUpperCase().trim(),
  ...(req.query?.veiculoId ? { _id: req.query.veiculoId } : {}),
});

const identificadorValido = (valor) =>
  typeof valor === 'string' && mongoose.isObjectIdOrHexString(valor);

module.exports = { filtroAcesso, filtroConsulta, identificadorValido };
