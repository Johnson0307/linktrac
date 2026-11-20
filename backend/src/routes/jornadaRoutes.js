const express = require('express');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { permite } = require('../services/acessosCliente');
const Motorista = require('../models/Motorista');
const solides = require('../services/solidesPonto');
const router = express.Router();
router.use(authenticate, authorize('admin', 'gestor'));
router.use((req, res, next) => {
  res.set('Cache-Control', 'private, no-store');
  if (!permite(req.user.acessos, 'operacao', req.method !== 'GET')) return res.status(403).json({ sucesso: false, mensagem: 'Jornada não está liberada para sua empresa.' });
  if (req.method !== 'GET' && req.path !== '/vinculos' && req.user.role !== 'admin') return res.status(403).json({ sucesso: false, mensagem: 'Somente o administrador pode configurar ou testar a conexão.' });
  next();
});
const executar = acao => async (req, res) => {
  try { res.json({ sucesso: true, dados: await acao(req) }); }
  catch (e) { res.status(e.code === 11000 ? 409 : e.status || 503).json({ sucesso: false,
    mensagem: e.code === 11000 ? 'Este colaborador externo já está vinculado a outro motorista.' : e.status ? e.message : 'Não foi possível concluir a operação da jornada.' }); }
};
const autor = req => req.user.email || String(req.user.id);
router.get('/', executar(async req => {
  const empresa = req.user.clienteId;
  const conta = await solides.obterConta(empresa);
  const [vinculos, motoristas] = await Promise.all([
    solides.Vinculo.find({ clienteId: empresa, provedor: conta.provedor }).sort({ updatedAt: -1 }).limit(1000).lean(),
    Motorista.find({ clienteId: empresa }).select('_id nome status').sort({ nome: 1 }).limit(1000).lean(),
  ]);
  return { conta, vinculos: vinculos.filter(v => v.provedor === conta.provedor), motoristas, provedores: solides.provedores };
}));
router.put('/configuracao', executar(req => solides.salvarConta(req.user.clienteId, autor(req), req.body)));
router.post('/testar', executar(req => solides.testarConta(req.user.clienteId)));
router.post('/desconectar', executar(async req => { await solides.desconectar(req.user.clienteId, autor(req)); return { desconectada: true }; }));
router.put('/vinculos', executar(req => solides.salvarVinculo(req.user.clienteId, autor(req), req.body)));
module.exports = router;
