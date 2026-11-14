const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { linktracAdmin } = require('../middlewares/linktracMiddleware');
const controller = require('../controllers/espelhamentoController');
router.use(authenticate, linktracAdmin);
router.get('/', controller.listar);
router.put('/:veiculoId/clientes/:clienteId', controller.autorizar);
router.delete('/:veiculoId/clientes/:clienteId', controller.revogar);
module.exports = router;
