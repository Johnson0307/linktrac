const express = require('express');
const router = express.Router();
const {
  listarUsuarios,
  criarUsuario,
  atualizarUsuario,
} = require('../controllers/usuarioController');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');

router.get('/', authenticate, authorize('admin', 'gestor'), listarUsuarios);
router.post('/', authenticate, authorize('admin', 'gestor'), criarUsuario);
router.put('/:id', authenticate, authorize('admin', 'gestor'), atualizarUsuario);

module.exports = router;
