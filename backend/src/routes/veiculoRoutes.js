const express = require('express');
const router = express.Router();
const {
  cadastrarVeiculo,
  atualizarVeiculo,
  listarVeiculos,
  buscarPorPlaca,
} = require('../controllers/veiculoController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const Veiculo = require('../models/Veiculo');
const { filtroAcesso } = require('../services/acessoVeiculo');

router.use('/mapa/referencias', require('./referenciasMapaRoutes'));
router.post('/', authenticate, authorize('admin', 'gestor'), cadastrarVeiculo);
router.put('/:id', authenticate, authorize('admin', 'gestor'), atualizarVeiculo);
router.get('/', authenticate, listarVeiculos);
router.get('/opcoes', authenticate, async (req, res) => {
  try {
    const dados = await Veiculo.find(filtroAcesso(req.user.clienteId))
      .select('placa marca modelo clienteId').sort({ placa: 1 }).lean();
    return res.json({ sucesso: true, dados });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível listar os veículos.' });
  }
});
router.get('/:placa', authenticate, buscarPorPlaca);

module.exports = router;
