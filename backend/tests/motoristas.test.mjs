import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const express = require('express');
const Usuario = require('../src/models/Usuario');
const Motorista = require('../src/models/Motorista');
const Acao = require('../src/models/AcaoUsuario');
const { validarMotorista } = require('../src/services/validarMotorista');
const empresa = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const dados = { nome: 'Motorista fictício', cpf: '123.456.789-09', cnh: '12345678901', validadeCnh: '2028-10-01', categoriaCnh: 'AB', status: 'ativo' };
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
async function request(path = '', { role = 'admin', method = 'GET', body, semToken = false } = {}) {
  vi.stubEnv('JWT_SECRET', 'segredo-teste');
  vi.spyOn(Usuario, 'findById').mockReturnValue({ select: async () => ({ _id: id, clienteId: empresa, email: 'teste@example.com', role, ativo: true }) });
  const app = express(); app.use(express.json()); app.use(require('../src/middlewares/auditoriaMiddleware').auditar);
  app.use('/api/motoristas', require('../src/routes/motoristaRoutes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise((r) => server.once('listening', r));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/motoristas${path}`, { method,
      headers: { 'Content-Type': 'application/json', ...(semToken ? {} : { Authorization: `Bearer ${require('jsonwebtoken').sign({ id }, process.env.JWT_SECRET)}` }) },
      ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, body: await response.json() };
  } finally { await new Promise((r) => server.close(r)); }
}
it('bloqueia consultas sem login e gravação de operadores', async () => {
  expect((await request('', { semToken: true })).status).toBe(401);
  expect((await request('', { role: 'operador', method: 'POST', body: dados })).status).toBe(403);
  expect((await request('/'+id, { role: 'motorista', method: 'PUT', body: dados })).status).toBe(403);
});
it('normaliza campos e ignora dados que tentam trocar empresa ou atribuir permissões', async () => {
  vi.spyOn(Motorista, 'init').mockResolvedValue(Motorista);
  const create = vi.spyOn(Motorista, 'create').mockImplementation(async (b) => ({ _id: id, ...b }));
  const audit = vi.spyOn(Acao, 'create').mockResolvedValue({});
  const r = await request('', { method: 'POST', body: { ...dados, clienteId: 'outra', role: 'admin', email: ' TESTE@example.com ' } });
  expect(r.status).toBe(201);
  expect(create.mock.calls[0][0]).toMatchObject({ clienteId: empresa, cpf: '12345678909', email: 'teste@example.com' });
  expect(create.mock.calls[0][0]).not.toHaveProperty('role');
  expect(audit.mock.calls[0][0]).toEqual({ clienteId: empresa, usuario: 'teste@example.com', metodo: 'POST', recurso: '/api/motoristas', status: 201 });
});
it('impede edição de motorista de outra empresa', async () => {
  vi.spyOn(Motorista, 'init').mockResolvedValue(Motorista);
  const update = vi.spyOn(Motorista, 'findOneAndUpdate').mockResolvedValue(null);
  const r = await request('/'+id, { method: 'PUT', body: dados });
  expect(r.status).toBe(404);
  expect(update.mock.calls[0][0]).toEqual({ _id: id, clienteId: empresa });
});
it('permite alterar situação sem excluir o cadastro', async () => {
  vi.spyOn(Motorista, 'init').mockResolvedValue(Motorista);
  const update = vi.spyOn(Motorista, 'findOneAndUpdate').mockImplementation(async (f, b) => ({ _id: id, ...b.$set }));
  vi.spyOn(Acao, 'create').mockResolvedValue({});
  const r = await request('/'+id, { role: 'gestor', method: 'PUT', body: { ...dados, status: 'inativo' } });
  expect(r.status).toBe(200); expect(r.body.dados.status).toBe('inativo');
  expect(update.mock.calls[0][1].$set).not.toHaveProperty('clienteId');
});
it('trata documento duplicado como conflito, sem expor dados', async () => {
  vi.spyOn(Motorista, 'init').mockResolvedValue(Motorista);
  vi.spyOn(Motorista, 'create').mockRejectedValue({ code: 11000, keyValue: { cpf: 'privado' } });
  const r = await request('', { method: 'POST', body: dados });
  expect(r.status).toBe(409); expect(JSON.stringify(r.body)).not.toContain('privado');
});
it('restringe consultas à empresa e omite documentos e contatos de usuários comuns', async () => {
  const select = vi.fn().mockReturnValue({ sort: () => ({ skip: () => ({ limit: () => ({ lean: async () => [] }) }) }) });
  const find = vi.spyOn(Motorista, 'find').mockReturnValue({ select });
  vi.spyOn(Motorista, 'countDocuments').mockResolvedValue(0);
  expect((await request('?busca=Ana&situacao=ativo&pagina=1', { role: 'operador' })).status).toBe(200);
  expect(find.mock.calls[0][0]).toMatchObject({ clienteId: empresa, status: 'ativo', nome: { $regex: 'Ana', $options: 'i' } });
  expect(select).toHaveBeenCalledWith('_id nome status categoriaCnh validadeCnh');
});
it.each([{ cpf: 'abc' }, { cnh: { $ne: null } }, { validadeCnh: '2028-02-31' }, { categoriaCnh: 'XYZ' }, { nome: ' ' }, { email: 'sem-arroba' }, { status: 'apagado' }, { observacoes: 'x'.repeat(1001) }])('valida campos antes de salvar %j', (extra) => {
  expect(validarMotorista({ ...dados, ...extra }).erros.length).toBeGreaterThan(0);
});
it('trata payload nulo e filtros inválidos', async () => {
  expect(validarMotorista(null).erros.length).toBeGreaterThan(0);
  expect((await request('?pagina=0')).status).toBe(400);
  expect((await request('?situacao=desconhecida')).status).toBe(400);
});
