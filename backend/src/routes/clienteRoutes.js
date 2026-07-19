const express = require('express');
const router = express.Router();
const { minhaEmpresa } = require('../controllers/clienteController');
const { authenticate } = require('../middlewares/authMiddleware');

router.get('/', authenticate, minhaEmpresa);

module.exports = router;
