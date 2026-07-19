const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

exports.authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ sucesso: false, mensagem: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'linktrac-secret');
    const usuario = await Usuario.findById(payload.id).select('-senha');
    if (!usuario) {
      return res.status(401).json({ sucesso: false, mensagem: 'Token inválido.' });
    }

    req.user = {
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      clienteId: usuario.clienteId,
    };
    next();
  } catch (err) {
    return res.status(401).json({ sucesso: false, mensagem: 'Falha na autenticação do token.' });
  }
};
