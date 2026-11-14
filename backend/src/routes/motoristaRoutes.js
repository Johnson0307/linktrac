const router = require('express').Router();
const controller = require('../controllers/motoristaController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
router.use(authenticate);
router.get('/', controller.listar);
router.post('/', authorize('admin', 'gestor'), controller.criar);
router.put('/:id', authorize('admin', 'gestor'), controller.atualizar);
module.exports = router;
