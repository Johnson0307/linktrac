const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Tracker, toPoint, LEASE_MS, MAX_QUEUE } = require('../.test-build/core');
const token = 'a'.repeat(64);
function setup() {
  const db = new Map(), calls = [];
  let now = 1800000000000, seq = 0, stops = 0, offline = false, paused = true, denied = false, supported = true, failSave = false;
  const p = { now: () => now, uuid: () => 'id-' + (++seq), stopGPS: async () => { stops++; },
    store: { get: async k => db.get(k) ?? null, set: async (k,v) => { if (failSave) throw Error('storage'); assert.ok(v.length < 2048); db.set(k,v); }, remove: async k => { db.delete(k); } },
    request: async (path, body, t) => {
      calls.push({path,body,token:t});
      if (offline) throw Error('offline');
      if (denied) throw Object.assign(Error('denied'),{status:403});
      if (path==='/app-info') return {appDisponivel:supported,versaoProtocolo:1};
      if (path==='/parear') return {token,nome:'Sintético'};
      if (path==='/status') return {nome:'Sintético',pausado:paused,appDisponivel:supported,autorizacaoApp:supported};
      if (path==='/iniciar') paused=false;
      if (path==='/pausar') paused=true;
      return {};
    },
  };
  const tracker = new Tracker(p);
  const fix = (offset=0) => ({timestamp:now+offset,coords:{latitude:0,longitude:0,accuracy:10,speed:null}});
  return { tracker, db, calls, fix, time: n => { now+=n; }, offline:v=>{offline=v;}, denied:v=>{denied=v;}, supported:v=>{supported=v;}, failSave:v=>{failSave=v;}, stops:()=>stops };
}
async function start(f) { await f.tracker.pair('ABCD-1234-ABCD','Celular sintético'); await f.tracker.start(async()=>{}); }
test('parear não inicia GPS nem envia posições e não armazena o código',async()=>{
  const f=setup();await f.tracker.pair('abcd-1234-abcd','Celular sintético');
  assert.equal((await f.tracker.view()).ativo,false);assert.equal(f.calls.length,2);
  assert.equal(f.calls[1].body.modalidade,'app');assert.ok(![...f.db.values()].join('').includes('ABCD1234ABCD'));
  assert.ok(!('token' in await f.tracker.view()));
});
test('código malformado é rejeitado antes de acessar a rede',async()=>{
  const f=setup();await assert.rejects(()=>f.tracker.pair('123456','Celular'));assert.equal(f.calls.length,0);
});
test('servidor não liberado não consome código nem concede acesso',async()=>{
  const f=setup();f.supported(false);await assert.rejects(()=>f.tracker.pair('ABCD1234ABCD','Teste'),/não foi liberado/);
  assert.ok(!f.calls.some(c=>c.path==='/parear'));assert.equal(f.db.size,0);
});
test('falha de gravação protegida invalida o token recém-emitido',async()=>{
  const f=setup();f.failSave(true);await assert.rejects(()=>f.tracker.pair('ABCD1234ABCD','Teste'));
  assert.equal(f.calls.at(-1).path,'/desparear');
});
test('autorização web antiga não libera início nativo',async()=>{
  const f=setup();await f.tracker.pair('ABCD1234ABCD','Teste');f.supported(false);
  await assert.rejects(()=>f.tracker.start(async()=>assert.fail()),/autorizar/);
  assert.ok(!f.calls.some(c=>c.path==='/iniciar'));
});
test('valida coordenadas e tempo, converte m/s e omite velocidade ausente',()=>{
  const f=setup(),now=f.fix().timestamp;
  assert.equal(toPoint(f.fix(),now,now,()=> 'id').velocidade,undefined);
  assert.equal(toPoint({...f.fix(),coords:{...f.fix().coords,speed:10}},now,now,()=> 'id').velocidade,36);
  assert.equal(toPoint({...f.fix(),coords:{...f.fix().coords,latitude:null}},now,now,()=> 'id'),null);
  assert.equal(toPoint(f.fix(-1),now,now,()=> 'id'),null);
});
test('envia lote privado compatível, não reenvia pontos em menos de 30 segundos',async()=>{
  const f=setup();await start(f);await f.tracker.receive([f.fix()]);f.time(1000);await f.tracker.receive([f.fix()]);
  const sends=f.calls.filter(c=>c.path==='/posicoes');assert.equal(sends.length,1);assert.equal(sends[0].token,token);
  assert.equal(sends[0].body.pontos[0].latitude,0);assert.equal((await f.tracker.view()).pendentes,0);
});
test('fila cifrada reaproveita os mesmos IDs depois de perder a confirmação de envio',async()=>{
  const f=setup();await start(f);
  // Status responde, envio perde ACK. O servidor deduplica o mesmo mensagemId.
  const original=f.tracker.p.request;let first=true;
  f.tracker.p.request=async(path,...args)=>{if(path==='/posicoes'&&first){first=false;throw Error('no ack');}return original(path,...args);};
  await f.tracker.receive([f.fix()]);assert.equal((await f.tracker.view()).pendentes,1);
  const queued=JSON.parse(f.db.get('lf.point.0'));f.time(1000);await f.tracker.receive([]);
  assert.equal(f.calls.find(c=>c.path==='/posicoes').body.pontos[0].mensagemId,queued.mensagemId);
});
test('sem confirmação por cinco minutos interrompe e apaga a fila',async()=>{
  const f=setup();await start(f);f.offline(true);await f.tracker.receive([f.fix()]);
  assert.equal((await f.tracker.view()).pendentes,1);f.time(LEASE_MS+1);await f.tracker.receive([f.fix()]);
  assert.equal((await f.tracker.view()).ativo,false);assert.equal((await f.tracker.view()).pendentes,0);assert.ok(f.stops()>0);
});
test('revogação impede novo envio e remove credenciais e fila',async()=>{
  const f=setup();await start(f);f.offline(true);await f.tracker.receive([f.fix()]);f.offline(false);f.denied(true);
  const enviosAntes=f.calls.filter(c=>c.path==='/posicoes').length;
  await f.tracker.receive([f.fix()]);assert.equal((await f.tracker.view()).pareado,false);assert.equal(f.db.size,0);
  assert.equal(f.calls.filter(c=>c.path==='/posicoes').length,enviosAntes);
});
test('parar offline bloqueia a coleta e descarta posições; novo início é explícito',async()=>{
  const f=setup();await start(f);f.offline(true);await f.tracker.receive([f.fix()]);await f.tracker.stop();
  await f.tracker.receive([f.fix()]);assert.equal((await f.tracker.view()).ativo,false);assert.equal((await f.tracker.view()).pendentes,0);
  f.offline(false);await f.tracker.sync();assert.equal((await f.tracker.view()).ativo,false);
});
test('falha de GPS desfaz o início e confirma pausa no servidor',async()=>{
  const f=setup();await f.tracker.pair('ABCD1234ABCD','Teste');
  await assert.rejects(()=>f.tracker.start(async()=>{throw Error('GPS');}));
  assert.equal((await f.tracker.view()).ativo,false);assert.equal(f.calls.at(-1).path,'/pausar');
});
test('stop concorrente não deixa a tarefa voltar a coletar',async()=>{
  const f=setup();await start(f);await Promise.all([f.tracker.receive([f.fix()]),f.tracker.stop(),f.tracker.receive([f.fix()])]);
  assert.equal((await f.tracker.view()).ativo,false);assert.equal((await f.tracker.view()).pendentes,0);
});
test('remoção offline limpa o acesso e os pontos locais',async()=>{
  const f=setup();await start(f);f.offline(true);await f.tracker.receive([f.fix()]);await f.tracker.stop(true);
  assert.equal(f.db.size,0);assert.equal((await f.tracker.view()).pareado,false);
});
test('a fila tem capacidade fixa mesmo com um lote grande dentro da janela autorizada',async()=>{
  const f=setup();await start(f);f.time(120000);f.offline(true);
  const base=f.fix().timestamp-120000;
  // Mais pontos que slots são ignorados pelo intervalo mínimo; slots nunca excedem o teto.
  await f.tracker.receive(Array.from({length:200},(_,i)=>({...f.fix(),timestamp:base+i*1000})));
  assert.ok((await f.tracker.view()).pendentes<=MAX_QUEUE);
});
