const Cliente = require('../models/Cliente');
const { authenticate } = require('./authMiddleware');
const { adminDaLinktrac } = require('./linktracMiddleware');
const { permite, regraApi } = require('../services/acessosCliente');
const { escopoEmpresa } = require('../services/carteiraRevenda');

const rotasPublicas = new Set(['/auth/login', '/auth/register', '/auth/register/status', '/cliente/marca/publica', '/cliente/briefings/receber', '/documentacao']);

function controlarAcessos(req, res, next) {
  let caminho;
  try { caminho = decodeURIComponent(req.path).toLowerCase().replace(/\/+$/, ''); }
  catch { return res.status(400).json({ sucesso: false, mensagem: 'Endereço inválido.' }); }
  if (rotasPublicas.has(caminho) || caminho.startsWith('/integracao/') || caminho.startsWith('/familia-dispositivo/') ||
      (caminho === '/rastreamento' && req.method === 'POST')) return next();

  return authenticate(req, res, async () => {
    if (adminDaLinktrac(req.user)) return next();
    try {
      const empresa = await Cliente.findById(req.user.clienteId).select('acessos tipo ativo revendedoraId').lean();
      const escopo = await escopoEmpresa(empresa);
      if (!escopo) return res.status(403).json({ sucesso: false, mensagem: 'Empresa da conta indisponível.' });
      req.user.acessos = escopo.acessos;
      req.user.tipoEmpresa = empresa.tipo || 'cliente';
      if (escopo.revendedora) req.user.revendedoraId = escopo.revendedora._id;
      if (empresa.tipo === 'revendedora' && req.user.role === 'admin') {
        req.user.podeGerenciarCarteira = true;
        if (/^\/cliente\/(cadastros|acessos\/opcoes)$/.test(caminho) || caminho.startsWith('/cliente/financeiro/') ||
            (req.method === 'PUT' && /^\/cliente\/[a-f0-9]{24}$/.test(caminho))) return next();
      }
      if (req.user.acessos === null) return next();
      const regra = regraApi(caminho, req.method);
      if (regra.livre || regra.modulos.some(modulo => permite(req.user.acessos, modulo, regra.alterar))) return next();
      return res.status(403).json({ sucesso: false, mensagem: 'A administração da Linktrac não liberou esta função para sua empresa.' });
    } catch {
      return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível verificar os acessos da empresa.' });
    }
  });
}

module.exports = { controlarAcessos };
