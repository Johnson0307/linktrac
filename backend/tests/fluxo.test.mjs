import { createRequire } from 'node:module';
import { afterEach, describe, expect, it, vi } from 'vitest';
const require = createRequire(import.meta.url);
const express = require('express');
const Usuario = require('../src/models/Usuario');
const Veiculo = require('../src/models/Veiculo');
const Localizacao = require('../src/models/Localizacao');
const auth = require('../src/controllers/authController');
const { authenticate } = require('../src/middlewares/authMiddleware');

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('cadastro e autenticação', () => {
  it('retorna indisponibilidade sem invalidar token quando o banco falha', async () => {
    vi.stubEnv('JWT_SECRET', 'segredo-apenas-para-testes');
    vi.spyOn(Usuario, 'findById').mockReturnValue({
      select: vi.fn().mockRejectedValue(new Error('banco indisponível')),
    });
    const token = require('jsonwebtoken').sign({ id: 'usuario' }, process.env.JWT_SECRET);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    const next = vi.fn();
    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(next).not.toHaveBeenCalled();
  });
  it('criptografa a senha ao salvar e permite comparar no login', async () => {
    const usuario = new Usuario({
      nome: 'Teste',
      email: 'teste@example.com',
      senha: 'senha-teste',
      clienteId: '507f1f77bcf86cd799439011',
    });
    vi.spyOn(Usuario.collection, 'insertOne').mockResolvedValue({
      acknowledged: true,
      insertedId: usuario._id,
    });
    vi.spyOn(Usuario.collection, 'updateOne').mockResolvedValue({
      acknowledged: true,
      modifiedCount: 1,
    });
    await usuario.save();
    expect(usuario.senha).not.toBe('senha-teste');
    expect(await usuario.compararSenha('senha-teste')).toBe(true);
    expect(await usuario.compararSenha('errada')).toBe(false);
    const hash = usuario.senha;
    usuario.nome = 'Novo nome';
    await usuario.save();
    expect(usuario.senha).toBe(hash);
  });

  it('não permite login nem sessão existente de usuário desativado', async () => {
    vi.stubEnv('JWT_SECRET', 'segredo-apenas-para-testes');
    const usuario = { _id: 'usuario', ativo: false, compararSenha: vi.fn() };
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);
    vi.spyOn(Usuario, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue(usuario) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    await auth.login({ body: { email: 'teste@example.com', senha: 'senha' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
    const token = require('jsonwebtoken').sign({ id: 'usuario' }, process.env.JWT_SECRET);
    const next = vi.fn();
    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenLastCalledWith(401);
  });
});

describe('fluxo HTTP de login, veículos e rastreamento', () => {
  it('autentica, cadastra, lista, recebe telemetria e consulta a posição', async () => {
    vi.stubEnv('JWT_SECRET', 'segredo-apenas-para-testes');
    vi.stubEnv('DEVICE_API_TOKEN', 'dispositivo-teste');
    const usuario = {
      _id: 'usuario',
      nome: 'Teste',
      email: 'teste@example.com',
      role: 'admin',
      clienteId: 'cliente',
      ativo: true,
      compararSenha: vi.fn().mockResolvedValue(true),
    };
    vi.spyOn(Usuario, 'findOne').mockResolvedValue(usuario);
    vi.spyOn(Usuario, 'findById').mockReturnValue({ select: vi.fn().mockResolvedValue(usuario) });
    let veiculo;
    let posicao;
    vi.spyOn(Veiculo, 'create').mockImplementation(
      async (dados) => (veiculo = { ...dados, _id: 'veiculo' })
    );
    vi.spyOn(Veiculo, 'find').mockImplementation(() =>
      Object.assign(Promise.resolve([veiculo]), {
        sort: async () => [veiculo],
        limit: async () => [veiculo],
      })
    );
    vi.spyOn(Veiculo, 'findOne').mockImplementation(async (filtro) =>
      filtro.placa === veiculo?.placa &&
      (!filtro.clienteId || filtro.clienteId === veiculo.clienteId)
        ? veiculo
        : null
    );
    vi.spyOn(Localizacao, 'create').mockImplementation(async (dados) => {
      posicao = dados;
      return posicao;
    });
    vi.spyOn(Localizacao, 'findOne').mockImplementation(() => ({
      sort: () => ({ lean: async () => posicao }),
    }));
    const app = express();
    app.use(express.json());
    app.use('/api/auth', require('../src/routes/authRoutes'));
    app.use('/api/veiculos', require('../src/routes/veiculoRoutes'));
    app.use('/api/rastreamento', require('../src/routes/rastreamentoRoutes'));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}/api`;
    const request = (path, options = {}) =>
      fetch(base + path, {
        ...options,
        headers: { 'Content-Type': 'application/json', ...options.headers },
      });
    try {
      expect((await request('/veiculos')).status).toBe(401);
      const login = await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: ' TESTE@example.com ', senha: 'senha' }),
      });
      expect(login.status).toBe(200);
      const { dados } = await login.json();
      const headers = { Authorization: `Bearer ${dados.token}` };
      expect((await request('/auth/me', { headers })).status).toBe(200);
      const created = await request('/veiculos', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          placa: ' abc1234 ',
          marca: 'Fiat',
          modelo: 'Uno',
          ano: 2020,
          nomeCliente: 'Cliente',
        }),
      });
      expect(created.status).toBe(201);
      const listed = await (await request('/veiculos', { headers })).json();
      expect(listed.dados[0].placa).toBe('ABC1234');
      const telemetry = {
        method: 'POST',
        body: JSON.stringify({
          placa: 'ABC1234',
          latitude: -23.5,
          longitude: -46.6,
          velocidade: 30,
        }),
      };
      expect((await request('/rastreamento', telemetry)).status).toBe(401);
      expect(
        (
          await request('/rastreamento', {
            ...telemetry,
            headers: { 'x-device-token': 'dispositivo-teste' },
          })
        ).status
      ).toBe(201);
      const tracked = await (await request('/rastreamento/ABC1234', { headers })).json();
      expect(tracked.sucesso).toBe(true);
      expect(tracked.veiculo.placa).toBe('ABC1234');
      expect(tracked.localizacao.status).toBe('Em movimento');
      expect(tracked.localizacao.coordenadas).toBe('-23.500000 , -46.600000');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
