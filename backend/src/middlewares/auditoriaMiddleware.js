const Acao = require('../models/AcaoUsuario');
exports.auditar = (req, res, next) => {
  // Este módulo mantém auditoria própria e retenção específica, sem coordenadas ou nomes de menores.
  if (/^\/api\/familia(?:\/|$)/i.test((req.originalUrl || '').split('?')[0])) return next();
  const json = res.json.bind(res);
  res.json = async (body) => {
    const usuario = req.user || (req.originalUrl?.split('?')[0] === '/api/auth/login' ? body?.dados?.usuario : null);
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && res.statusCode < 400 && body?.sucesso && usuario?.clienteId) {
      try {
        await Acao.create({ clienteId: usuario.clienteId, usuario: usuario.email || String(usuario.id),
          metodo: req.method, recurso: (req.originalUrl || '').split('?')[0].slice(0, 250), status: res.statusCode });
      } catch {
        res.setHeader('X-Linktrac-Auditoria', 'indisponivel');
        console.error('Não foi possível registrar a auditoria desta operação.');
      }
    }
    return json(body);
  };
  next();
};
