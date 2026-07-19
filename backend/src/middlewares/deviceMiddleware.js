exports.deviceAuthenticate = (req, res, next) => {
  const deviceToken = process.env.DEVICE_API_TOKEN;
  if (!deviceToken) {
    return next();
  }

  const providedToken =
    req.headers['x-device-token'] || req.body?.deviceToken || req.query?.deviceToken;
  if (!providedToken || providedToken !== deviceToken) {
    return res
      .status(401)
      .json({ sucesso: false, mensagem: 'Token de dispositivo inválido ou ausente.' });
  }

  return next();
};
