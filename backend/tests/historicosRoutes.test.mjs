import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const express = require('express');
const Usuario = require('../src/models/Usuario');
const Veiculo = require('../src/models/Veiculo');
const Manutencao = require('../src/models/Manutencao');
const Acao = require('../src/models/AcaoUsuario');
const empresa = '507f1f77bcf86cd799439011';
const outro = '507f1f77bcf86cd799439012';
const id = '507f1f77bcf86cd799439013';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function request(path, { role = 'admin', method = 'GET', body, semToken = false } = {}) {
  vi.stubEnv('JWT_SECRET', 'segredo-teste');
  vi.spyOn(Usuario, 'findById').mockReturnValue({ select: async () => ({ _id: id, clienteId: empresa, email: 'admin@example.com', role, ativo: true }) });
  const app = express(); app.use(express.json()); app.use(require('../src/middlewares/auditoriaMiddleware').auditar);
  app.use('/api/historicos', require('../src/routes/historicosRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/historicos${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(semToken ? {} : { Authorization: `Bearer ${require('jsonwebtoken').sign({ id }, process.env.JWT_SECRET)}` }) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  } finally { await new Promise((r) => server.close(r)); }
}
it('bloqueia acesso sem login e auditoria de operador', async () => {
  expect((await request('/acoes', { semToken: true })).status).toBe(401);
  expect((await request('/acoes', { role: 'operador' })).status).toBe(403);
});
it('não revela eventos de veículo sem propriedade ou espelhamento', async () => {
  const find = vi.spyOn(Veiculo, 'findOne').mockResolvedValue(null);
  expect((await request(`/${id}/eventos`)).status).toBe(404);
  expect(find).toHaveBeenCalledWith({ _id: id, $or: [{ clienteId: empresa }, { clientesEspelhados: empresa }] });
});
it('não expõe manutenção para empresa com mero espelhamento', async () => {
  vi.spyOn(Veiculo, 'findOne').mockResolvedValue({ _id: id, clienteId: outro });
  expect((await request(`/${id}/manutencoes`)).status).toBe(403);
});
it('registra serviço da proprietária e auditoria sem dados do formulário', async () => {
  vi.spyOn(Veiculo, 'findOne').mockResolvedValue({ _id: id, clienteId: empresa });
  const create = vi.spyOn(Manutencao, 'create').mockImplementation(async (b) => ({ ...b, _id: id }));
  const audit = vi.spyOn(Acao, 'create').mockResolvedValue({});
  const r = await request(`/${id}/manutencoes`, { method: 'POST', body: { servico: 'Troca de óleo', dataServico: '2026-10-26', custoCentavos: 15000, quilometragem: 10000, proximaQuilometragem: 15000 } });
  expect(r.status).toBe(201); expect(create.mock.calls[0][0].clienteId).toBe(empresa);
  expect(audit.mock.calls[0][0]).toEqual({ clienteId: empresa, usuario: 'admin@example.com', metodo: 'POST', recurso: `/api/historicos/${id}/manutencoes`, status: 201 });
});
it.each([{ custoCentavos: -1 }, { dataServico: '2026-02-31' }, { proximaQuilometragem: 1 }, { servico: {} }])('rejeita serviço inválido %j', async (extra) => {
  vi.spyOn(Veiculo, 'findOne').mockResolvedValue({ _id: id, clienteId: empresa });
  const create = vi.spyOn(Manutencao, 'create');
  const r = await request(`/${id}/manutencoes`, { method: 'POST', body: { servico: 'Óleo', dataServico: '2026-10-26', custoCentavos: 100, quilometragem: 1000, ...extra } });
  expect(r.status).toBe(400); expect(create).not.toHaveBeenCalled();
});
it('isola auditoria por empresa e limita a quantidade de registros', async () => {
  const find = vi.spyOn(Acao, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
  expect((await request('/acoes')).status).toBe(200);
  expect(find).toHaveBeenCalledWith({ clienteId: empresa });
});
