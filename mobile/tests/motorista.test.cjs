const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MotoristaApp } = require('../.test-build/motoristaCore');
function preparar() {
  const db = new Map(), calls = []; let offline = false, role = 'motorista', failStore = false;
  const app = new MotoristaApp({ plataforma: 'android', uuid: () => '507f1f77-bcf8-4cd7-9943-901199439011',
    store: { get: async k => db.get(k) || null, set: async (k, v) => { if (failStore && k.includes('session')) throw Error('storage'); db.set(k, v); }, remove: async k => db.delete(k) },
    request: async (path, body, credencial, tipo) => {
      calls.push({ path, body, credencial, tipo }); if (offline) throw Error('offline');
      if (path === '/auth/login') return { token: 'jwt-somente-na-memoria', usuario: { role } };
      if (path === '/motorista-app/registrar') return { token: 'a'.repeat(64), expiraEm: '2027-01-01T12:00:00Z', pushAtivo: false };
      if (path === '/motorista-app/status') return { nome: 'MOTORISTA TESTE', pushAtivo: false };
      if (path === '/motorista-app/lembretes') return [];
      return { dispensado: true, pontoRegistrado: false };
    },
  });
  return { app, db, calls, offline: v => { offline = v; }, role: v => { role = v; }, failStore: () => { failStore = true; } };
}
test('login mantém somente a credencial própria protegida e não guarda senha nem JWT', async () => {
  const p = preparar(); await p.app.entrar('12345678900', 'senha-ficticia');
  const salvo = [...p.db.values()].join(' '); assert.ok(!salvo.includes('senha-ficticia')); assert.ok(!salvo.includes('jwt-somente'));
  assert.equal(p.calls.find(c => c.path.endsWith('/registrar')).tipo, 'Bearer');
  assert.equal(p.calls.find(c => c.path.endsWith('/status')).tipo, 'Motorista');
  assert.equal(p.calls.find(c => c.path.endsWith('/registrar')).body.pushAtivo, false);
});
test('recusa conta administrativa e troca de conta sem desconectar', async () => {
  const p = preparar(); p.role('admin'); await assert.rejects(p.app.entrar('teste', 'senha'), /Motorista/);
  assert.equal(p.calls.some(c => c.path.endsWith('/registrar')), false);
  p.role('motorista'); await p.app.entrar('teste', 'senha'); await assert.rejects(p.app.entrar('outro', 'senha'), /Saia/);
});
test('sem internet não esquece credencial de revogação; reconexão permite sair', async () => {
  const p = preparar(); await p.app.entrar('teste', 'senha'); p.offline(true);
  await assert.rejects(p.app.sair(), /internet/); assert.ok(await p.app.sessao());
  p.offline(false); await p.app.sair(); assert.equal(await p.app.sessao(), null);
});
test('falha de armazenamento revoga a sessão recém-criada', async () => {
  const p = preparar(); p.failStore(); await assert.rejects(p.app.entrar('teste', 'senha'), /salvar/);
  assert.ok(p.calls.some(c => c.path.endsWith('/desconectar'))); assert.equal(await p.app.sessao(), null);
});
test('dispensar é independente de marcação oficial e não aceita caminho livre', async () => {
  const p = preparar(); await p.app.entrar('teste', 'senha');
  await assert.rejects(async () => p.app.dispensar('../outra'), /inválido/);
  const r = await p.app.dispensar('507f1f77bcf86cd799439011'); assert.equal(r.pontoRegistrado, false);
  assert.equal(p.calls.some(c => /punch|bater|marcacao/.test(c.path)), false);
});
