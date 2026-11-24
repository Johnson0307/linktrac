/* Teste local descartável. Não lê .env e não acessa a Sólides nem bancos externos. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const express = require('express');
const net = require('node:net');
const esperar = ms => new Promise(r => setTimeout(r, ms));
async function main() {
  const reserva = net.createServer(); reserva.listen(0, '127.0.0.1');
  await new Promise(r => reserva.once('listening', r));
  const porta = reserva.address().port; await new Promise(r => reserva.close(r));
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'linktrac-jornada-teste-'));
  const replica = 'jornada_teste';
  const mongo = spawn('C:/Program Files/MongoDB/Server/8.2/bin/mongod.exe', [
    '--dbpath', pasta, '--port', String(porta), '--bind_ip', '127.0.0.1', '--replSet', replica,
    '--logpath', path.join(pasta, 'mongo.log'),
  ], { windowsHide: true, stdio: 'ignore' });
  let servidor, conexaoInicial, verificacoes = 0;
  const checar = (ok, mensagem) => { assert.ok(ok, mensagem); verificacoes++; };
  const base = `mongodb://127.0.0.1:${porta}/linktrac_jornada_teste_${randomUUID().replaceAll('-', '')}`;
  try {
    for (let i = 0; i < 40; i++) {
      try { conexaoInicial = await mongoose.createConnection(base + '?directConnection=true', { serverSelectionTimeoutMS: 300 }).asPromise(); break; }
      catch { await esperar(100); }
    }
    assert.ok(conexaoInicial, 'Mongo local não iniciou');
    await conexaoInicial.db.admin().command({ replSetInitiate: { _id: replica, members: [{ _id: 0, host: `127.0.0.1:${porta}` }] } });
    for (let i = 0; i < 100; i++) {
      if ((await conexaoInicial.db.admin().command({ hello: 1 })).isWritablePrimary) break;
      await esperar(100);
    }
    await conexaoInicial.close(); conexaoInicial = null;
    await mongoose.connect(base + `?replicaSet=${replica}&directConnection=true`);
    const Cliente = require('../src/models/Cliente');
    const Motorista = require('../src/models/Motorista');
    const Usuario = require('../src/models/Usuario');
    const { Notificacao } = require('../src/operacao/modelos');
    const ponto = require('../src/services/lembretePonto');
    const oid = () => new mongoose.Types.ObjectId();
    const a = oid(), b = oid(), veiculo = { _id: oid(), clienteId: a, placa: 'TESTE01' };
    process.env.LINKTRAC_CLIENT_ID = String(oid());
    await Cliente.create([{ _id: a, nome: 'TESTE JORNADA A', slug: 'teste-jornada-a', acessos: { operacao: 'configurar' } },
      { _id: b, nome: 'TESTE JORNADA B', slug: 'teste-jornada-b', acessos: { operacao: 'configurar' } }]);
    const m = await Motorista.create({ clienteId: a, nome: 'MOTORISTA SINTETICO', cpf: '11144477735', cnh: '12345678901',
      validadeCnh: '2030-01-01', categoriaCnh: 'D', identificador: 'leitor-teste', email: 'motorista@example.invalid' });
    await Motorista.create({ clienteId: b, nome: 'OUTRO MOTORISTA SINTETICO', cpf: '11144477735', cnh: '12345678901',
      validadeCnh: '2030-01-01', categoriaCnh: 'D', identificador: 'leitor-teste', email: 'outro@example.invalid' });
    const users = await Usuario.create([
      { clienteId: a, nome: 'MOTORISTA TESTE', email: m.email, senha: randomUUID(), role: 'motorista' },
      { clienteId: a, nome: 'ADMIN TESTE', email: 'admin@example.invalid', senha: randomUUID(), role: 'admin' },
      { clienteId: b, nome: 'OUTRA EMPRESA TESTE', email: 'outro@example.invalid', senha: randomUUID(), role: 'motorista' },
    ]);
    await Promise.all(Object.values(mongoose.models).map(model => model.init()));
    const app = express(); app.use(express.json());
    app.use((req, res, next) => {
      const u = users.find(u => String(u._id) === req.get('x-test-user'));
      if (u) req.user = { id: u._id, clienteId: u.clienteId, role: u.role, email: u.email };
      next();
    });
    app.use('/api', require('../src/middlewares/acessosMiddleware').controlarAcessos);
    app.use('/api/jornada', require('../src/routes/jornadaRoutes'));
    servidor = app.listen(0, '127.0.0.1'); await new Promise(r => servidor.once('listening', r));
    const pedir = async (caminho, user, body) => {
      const res = await fetch(`http://127.0.0.1:${servidor.address().port}/api/jornada${caminho}`, {
        method: body ? caminho === '/lembrete' ? 'PUT' : 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json', ...(user ? { 'x-test-user': String(user._id) } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}),
      }); return { status: res.status, ...(await res.json()) };
    };
    let horario = Date.now() - 10000;
    const receber = async campos => ponto.processar(veiculo, { fonte: 'dispositivo', dispositivoId: 'equipamento-autenticado',
      ignicao: true, dataHora: new Date(horario += 10), telemetria: { identificadorMotorista: 'leitor-teste' }, ...campos });
    checar((await pedir('/meus-lembretes')).status === 401, 'Visitante recusado');
    await receber({}); checar(await Notificacao.countDocuments() === 0, 'Começa desligado');
    checar((await pedir('/lembrete', users[0], { ativo: true })).status === 403, 'Motorista não altera configuração');
    checar((await pedir('/lembrete', users[1], { ativo: true, clienteId: String(b) })).status === 200, 'Administrador ativa apenas sua empresa');
    checar(!(await ponto.obterConfiguracao(b)).ativo, 'Outra empresa permanece desligada');
    await receber({ telemetria: {}, motoristaId: m._id });
    await receber({ telemetria: { identificadorMotorista: 'nao-cadastrado' } });
    checar(await Notificacao.countDocuments() === 0, 'Vínculo e identificador desconhecido não avisam');
    await receber({}); checar(await Notificacao.countDocuments() === 1, 'Identificação após ignição cria aviso');
    await Promise.all([1, 2, 3, 4].map(() => receber({})));
    checar(await Notificacao.countDocuments() === 1, 'Concorrência não repete aviso');
    const meus = await pedir('/meus-lembretes', users[0]);
    checar(meus.status === 200 && meus.dados.length === 1, 'Motorista consulta seu lembrete');
    const avisoId = meus.dados[0]._id;
    checar(!JSON.stringify(meus).includes('leitor-teste'), 'Identificador do leitor não é exposto');
    checar((await pedir(`/meus-lembretes/${avisoId}/dispensar`, users[2], {})).status === 404, 'Motorista de outra empresa não dispensa aviso');
    checar((await pedir('/meus-lembretes', users[2])).dados.length === 0, 'Mesmo identificador em outra empresa não revela aviso');
    checar((await pedir('/meus-lembretes', users[1])).status === 403, 'Administrador não assume identidade de motorista');
    await receber({ ignicao: false });
    checar((await pedir('/meus-lembretes', users[0])).dados.length === 0, 'Desligamento oculta aviso antigo');
    await receber({});
    checar(await Notificacao.countDocuments() === 2, 'Novo ciclo cria outro aviso');
    const novo = (await pedir('/meus-lembretes', users[0])).dados[0];
    checar(novo._id !== avisoId, 'Ciclo anterior não reaparece');
    const dispensado = await pedir(`/meus-lembretes/${novo._id}/dispensar`, users[0], {});
    checar(dispensado.status === 200 && dispensado.dados.pontoRegistrado === false, 'Dispensar não registra ponto');
    await receber({}); checar((await pedir('/meus-lembretes', users[0])).dados.length === 0, 'Dispensa persiste sem repetição');
    await receber({ fonte: 'simulado' }); await receber({ dataHora: new Date(Date.now() - 600000) });
    checar(await Notificacao.countDocuments() === 2, 'Simulação e atraso não criam lembretes');
    await Cliente.updateOne({ _id: a }, { $set: { acessos: { operacao: 'bloqueado' } } });
    checar((await pedir('/meus-lembretes', users[0])).status === 403, 'Revogação do módulo é respeitada');
    const outroVeiculo = { ...veiculo, _id: oid(), placa: 'TESTE02' };
    const concorrentes = await Promise.allSettled([1, 2, 3, 4].map(i => ponto.processar(outroVeiculo, {
      fonte: 'dispositivo', dispositivoId: 'equipamento-autenticado', ignicao: true,
      dataHora: new Date(Date.now() + i), telemetria: { identificadorMotorista: 'leitor-teste' },
    })));
    checar(concorrentes.every(r => r.status === 'fulfilled'), 'Primeira leitura concorrente não perde processamento');
    checar(await Notificacao.countDocuments({ veiculoId: outroVeiculo._id }) === 1, 'Primeira leitura concorrente cria somente um aviso');
    console.log(`JORNADA_ISOLADA_OK: ${verificacoes} verificações; somente cadastros sintéticos e banco local descartável.`);
  } finally {
    if (servidor) await new Promise(r => servidor.close(r));
    if (conexaoInicial) await conexaoInicial.close();
    if (mongoose.connection.readyState === 1) await mongoose.connection.dropDatabase();
    await mongoose.disconnect(); mongo.kill();
  }
}
main().catch(() => { console.error('JORNADA_ISOLADA_FALHOU: confira o teste e o MongoDB local.'); process.exitCode = 1; });
