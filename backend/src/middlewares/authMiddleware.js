const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

exports.authenticate = async (req, res, next) => {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res
      .status(401)
      .json({ sucesso: false, mensagem: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      return res
        .status(500)
        .json({ sucesso: false, mensagem: 'JWT_SECRET não configurado no servidor.' });
    }

    const payload = jwt.verify(token, jwtSecret);
    const usuario = await Usuario.findById(payload.id).select('-senha');
    if (!usuario || usuario.ativo === false) {
      return res.status(401).json({ sucesso: false, mensagem: 'Token inválido.' });
    }

    req.user = {
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      clienteId: usuario.clienteId,
      podeGerenciarEspelhamentos:
        usuario.role === 'admin' &&
        Boolean(process.env.LINKTRAC_CLIENT_ID) &&
        String(usuario.clienteId) === process.env.LINKTRAC_CLIENT_ID,
    };
    next();
  } catch (err) {
    if (
      err instanceof jwt.JsonWebTokenError ||
      err instanceof jwt.TokenExpiredError ||
      err instanceof jwt.NotBeforeError
    ) {
      return res.status(401).json({ sucesso: false, mensagem: 'Falha na autenticação do token.' });
    }
    return res
      .status(503)
      .json({ sucesso: false, mensagem: 'Não foi possível verificar a sessão. Tente novamente.' });
  }
};
