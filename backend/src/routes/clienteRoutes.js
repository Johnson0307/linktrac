const express = require('express');
const router = express.Router();
const { minhaEmpresa, listar, atualizar, criar, opcoesAcessos } = require('../controllers/clienteController');
const { authenticate } = require('../middlewares/authMiddleware');

const { authorize } = require('../middlewares/authorizationMiddleware');

router.use('/briefings', require('./briefingRoutes'));
router.use('/marca', require('./marcaVisualRoutes'));
router.use('/financeiro', require('./cadastroFinanceiroRoutes'));
router.use('/:clienteId/integracoes', require('./chaveIntegracaoRoutes'));
router.get('/', authenticate, minhaEmpresa);
router.get('/cadastros', authenticate, authorize('admin'), listar);
router.post('/cadastros', authenticate, authorize('admin'), criar);
router.get('/acessos/opcoes', authenticate, authorize('admin'), opcoesAcessos);
router.put('/:id', authenticate, authorize('admin'), atualizar);

module.exports = router;
