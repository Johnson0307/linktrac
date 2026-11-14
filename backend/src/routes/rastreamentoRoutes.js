const express = require('express');
const router = express.Router();
const {
  atualizarPosicao,
  consultarUltimaPosicao,
  consultarHistorico,
} = require('../controllers/rastreamentoController');
const { authenticate } = require('../middlewares/authMiddleware');
const { deviceAuthenticate } = require('../middlewares/deviceMiddleware');

router.post('/', deviceAuthenticate, atualizarPosicao);
router.get('/:placa/historico', authenticate, consultarHistorico);
router.get('/:placa', authenticate, consultarUltimaPosicao);

module.exports = router;
