const express = require('express');
const router = express.Router();
const {
  cadastrarVeiculo,
  listarVeiculos,
  buscarPorPlaca,
} = require('../controllers/veiculoController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');

router.post('/', authenticate, authorize('admin', 'gestor'), cadastrarVeiculo);
router.get('/', authenticate, listarVeiculos);
router.get('/:placa', authenticate, buscarPorPlaca);

module.exports = router;
