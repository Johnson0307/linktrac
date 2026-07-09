const express = require('express');
const router = express.Router();
const {
  cadastrarVeiculo,
  listarVeiculos,
  buscarPorPlaca,
} = require('../controllers/veiculoController');

router.post('/', cadastrarVeiculo);
router.get('/', listarVeiculos);
router.get('/:placa', buscarPorPlaca);

module.exports = router;
