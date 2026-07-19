import { describe, it, expect, vi } from 'vitest';
import api from './api';
import { login, register, me } from './auth';

vi.mock('./api', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

describe('auth api', () => {
  it('login retorna os dados do servidor', async () => {
    api.post.mockResolvedValue({ data: { dados: { token: 'abc', usuario: { nome: 'Teste' } } } });
    const resposta = await login('teste@example.com', 'senha123');

    expect(resposta).toEqual({ dados: { token: 'abc', usuario: { nome: 'Teste' } } });
    expect(api.post).toHaveBeenCalledWith('/auth/login', {
      email: 'teste@example.com',
      senha: 'senha123',
    });
  });

  it('register retorna os dados do servidor', async () => {
    const payload = {
      nomeEmpresa: 'Empresa',
      slug: 'empresa',
      cnpj: '123',
      nome: 'Admin',
      email: 'admin@example.com',
      senha: 'senha123',
    };
    api.post.mockResolvedValue({ data: { dados: { token: 'abc', usuario: { nome: 'Admin' } } } });

    const resposta = await register(payload);

    expect(resposta).toEqual({ dados: { token: 'abc', usuario: { nome: 'Admin' } } });
    expect(api.post).toHaveBeenCalledWith('/auth/register', payload);
  });

  it('me retorna os dados do servidor', async () => {
    api.get.mockResolvedValue({ data: { dados: { nome: 'Usuario' } } });
    const resposta = await me();

    expect(resposta).toEqual({ dados: { nome: 'Usuario' } });
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });
});
