import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const express = require('express');
const Usuario = require('../src/models/Usuario'),
  Veiculo = require('../src/models/Veiculo');
const { Analise, Solicitacao } = require('../src/operacao/agenteModelos');
const empresa = '507f1f77bcf86cd799439011',
  id = '507f1f77bcf86cd799439012';
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
async function request(path, { role = 'admin', method = 'GET', body, semToken = false } = {}) {
  vi.stubEnv('JWT_SECRET', 'teste');
  vi.spyOn(Usuario, 'findById').mockReturnValue({
    select: async () => ({
      _id: id,
      clienteId: empresa,
      role,
      ativo: true,
      email: 'gestor@example.com',
    }),
  });
  const app = express();
  app.use(express.json());
  app.use(require('../src/operacao/agenteRotas').router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise((r) => server.once('listening', r));
  try {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(semToken
          ? {}
          : {
              Authorization:
                'Bearer ' + require('jsonwebtoken').sign({ id }, process.env.JWT_SECRET),
            }),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    return { status: r.status, body: await r.json() };
  } finally {
    await new Promise((r) => server.close(r));
  }
}
it('bloqueia usuário sem login e perfis comuns', async () => {
  expect((await request('/status', { semToken: true })).status).toBe(401);
  expect((await request('/status', { role: 'operador' })).status).toBe(403);
  expect(
    (await request('/' + id + '/analisar', { method: 'POST', role: 'motorista' })).status
  ).toBe(403);
});
it('veículo de outra empresa não permite análise nem configuração', async () => {
  const find = vi.spyOn(Veiculo, 'findOne').mockReturnValue({ lean: async () => null });
  expect((await request('/' + id + '/analisar', { method: 'POST' })).status).toBe(404);
  expect(find).toHaveBeenCalledWith({ _id: id, clienteId: empresa });
  expect(
    (await request('/' + id + '/config', { method: 'PUT', body: { temperaturaMotorMax: 100 } }))
      .status
  ).toBe(404);
});
it('solicitação exige análise da própria empresa', async () => {
  const find = vi.spyOn(Analise, 'findOne').mockReturnValue({ lean: async () => null });
  expect(
    (await request('/analises/' + id + '/solicitacoes', { method: 'POST', body: { codigo: 'x' } }))
      .status
  ).toBe(404);
  expect(find).toHaveBeenCalledWith({ _id: id, clienteId: empresa });
});
it('decisão exige parecer e não conclui inspeção pendente', async () => {
  expect(
    (
      await request('/solicitacoes/' + id, {
        method: 'PUT',
        body: { status: 'aprovada', parecer: 'curto' },
      })
    ).status
  ).toBe(400);
  vi.spyOn(Solicitacao, 'findOne').mockReturnValue({
    lean: async () => ({ _id: id, status: 'pendente' }),
  });
  const update = vi.spyOn(Solicitacao, 'findOneAndUpdate');
  expect(
    (
      await request('/solicitacoes/' + id, {
        method: 'PUT',
        body: { status: 'concluida', parecer: 'Inspeção realizada' },
      })
    ).status
  ).toBe(409);
  expect(update).not.toHaveBeenCalled();
});
it('aprovação preserva histórico e usa comparação da situação anterior', async () => {
  vi.spyOn(Solicitacao, 'findOne').mockReturnValue({
    lean: async () => ({ _id: id, status: 'pendente' }),
  });
  const update = vi
    .spyOn(Solicitacao, 'findOneAndUpdate')
    .mockResolvedValue({ _id: id, status: 'aprovada' });
  expect(
    (
      await request('/solicitacoes/' + id, {
        method: 'PUT',
        body: { status: 'aprovada', parecer: 'Agendado para inspeção', clienteId: 'outra' },
      })
    ).status
  ).toBe(200);
  expect(update.mock.calls[0][0]).toEqual({ _id: id, clienteId: empresa, status: 'pendente' });
  expect(update.mock.calls[0][1].$push.historico).toMatchObject({
    status: 'aprovada',
    parecer: 'Agendado para inspeção',
  });
  expect(update.mock.calls[0][1].$set.aberta).toBe(true);
});
it('corrida de aprovação não sobrescreve decisão feita por outro gestor', async () => {
  vi.spyOn(Solicitacao, 'findOne').mockReturnValue({
    lean: async () => ({ _id: id, status: 'pendente' }),
  });
  vi.spyOn(Solicitacao, 'findOneAndUpdate').mockResolvedValue(null);
  expect(
    (
      await request('/solicitacoes/' + id, {
        method: 'PUT',
        body: { status: 'aprovada', parecer: 'Agendar inspeção técnica' },
      })
    ).status
  ).toBe(409);
});
