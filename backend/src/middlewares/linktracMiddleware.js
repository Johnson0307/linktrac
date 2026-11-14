const adminDaLinktrac = (user) => Boolean(process.env.LINKTRAC_CLIENT_ID &&
  user?.role === 'admin' && String(user.clienteId) === process.env.LINKTRAC_CLIENT_ID);
exports.adminDaLinktrac = adminDaLinktrac;
exports.linktracAdmin = (req, res, next) => {
  if (!adminDaLinktrac(req.user)) {
    return res
      .status(403)
      .json({
        sucesso: false,
        mensagem: 'Apenas a administração Linktrac pode gerenciar espelhamentos.',
      });
  }
  return next();
};
