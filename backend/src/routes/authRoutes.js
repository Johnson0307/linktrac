const express = require('express');
const router = express.Router();
const { register, login, me, statusCadastro } = require('../controllers/authController');
const { authenticate } = require('../middlewares/authMiddleware');

router.post('/register', register);
router.get('/register/status', statusCadastro);
router.post('/login', login);
router.get('/me', authenticate, me);

module.exports = router;
