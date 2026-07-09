const express = require('express');
const router = express.Router();
const {
  atualizarPosicao,
  consultarUltimaPosicao,
} = require('../controllers/rastreamentoController');

router.post('/', atualizarPosicao);
router.get('/:placa', consultarUltimaPosicao);

module.exports = router;
