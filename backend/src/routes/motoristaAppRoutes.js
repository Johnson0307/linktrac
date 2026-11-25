const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const push = require('../services/pushMotorista');
const lembrete = require('../services/lembretePonto');
const limites = new Map();
function limitar(chave, maximo) {
  const agora = Date.now(), anterior = limites.get(chave);
  const atual = !anterior || agora - anterior.em >= 60000 ? { em: agora, total: 0 } : anterior;
  if (++atual.total > maximo) throw Object.assign(new Error('Aguarde um minuto antes de tentar novamente.'), { status: 429 });
  limites.set(chave, atual); if (limites.size > 10000) limites.delete(limites.keys().next().value);
}
router.use((_req, res, next) => { res.set('Cache-Control', 'private, no-store'); next(); });
const tratar = acao => async (req, res) => {
  try { res.json({ sucesso: true, dados: await acao(req) }); }
  catch (e) { res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Não foi possível acessar o aplicativo do motorista.' }); }
};
router.post('/registrar', authenticate, tratar(async req => {
  limitar('registrar:' + req.user.id, 5);
  return push.registrar(req.user, req.body);
}));
router.use(async (req, res, next) => {
  try {
    const token = req.get('Authorization')?.match(/^Motorista ([a-f0-9]{64})$/)?.[1];
    const acesso = await push.autenticar(token, req.method === 'POST' && req.path === '/desconectar');
    limitar('app:' + acesso.aparelho._id, 120);
    req.aparelhoMotorista = acesso.aparelho; req.motoristaUser = acesso.user;
    if (acesso.user) req.user = acesso.user;
    next();
  } catch (e) { res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Não foi possível conferir o acesso do aplicativo.' }); }
});
router.get('/status', tratar(req => push.status(req.motoristaUser, req.aparelhoMotorista)));
router.get('/lembretes', tratar(req => lembrete.meusLembretes(req.motoristaUser)));
router.post('/notificacoes', tratar(req => push.configurarAvisos(req.aparelhoMotorista, req.body)));
router.post('/lembretes/:id/dispensar', tratar(req => lembrete.dispensar(req.motoristaUser, req.params.id)));
router.post('/desconectar', tratar(req => push.desconectar(req.aparelhoMotorista)));
module.exports = router;
