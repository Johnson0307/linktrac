const express = require('express');
const router = express.Router();
const {
  atualizarPosicao,
  consultarUltimaPosicao,
} = require('../controllers/rastreamentoController');
const { authenticate } = require('../middlewares/authMiddleware');
const { deviceAuthenticate } = require('../middlewares/deviceMiddleware');

router.post('/', deviceAuthenticate, atualizarPosicao);
router.get('/:placa', authenticate, consultarUltimaPosicao);

module.exports = router;
