exports.authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ sucesso: false, mensagem: 'Sem autorização.' });
    }

    if (!allowedRoles.length || allowedRoles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado para este usuário.' });
  };
};
