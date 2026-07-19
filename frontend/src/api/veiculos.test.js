import { describe, it, expect, vi } from 'vitest';
import api from './api';
import { listarTodos, cadastrarVeiculo, buscarPorPlaca } from './veiculos';

vi.mock('./api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

describe('veiculos api', () => {
  it('listarTodos retorna os dados do servidor', async () => {
    api.get.mockResolvedValue({ data: { dados: [{ placa: 'ABC1234' }] } });
    const resposta = await listarTodos();
    expect(resposta).toEqual({ dados: [{ placa: 'ABC1234' }] });
    expect(api.get).toHaveBeenCalledWith('/veiculos');
  });

  it('buscarPorPlaca chama a rota correta e retorna os dados', async () => {
    api.get.mockResolvedValue({ data: { dados: { placa: 'ABC1234' } } });
    const resposta = await buscarPorPlaca('abc1234');
    expect(resposta).toEqual({ dados: { placa: 'ABC1234' } });
    expect(api.get).toHaveBeenCalledWith('/veiculos/ABC1234');
  });

  it('cadastrarVeiculo envia os dados corretos e retorna a resposta', async () => {
    const payload = { placa: 'ABC1234', marca: 'Teste' };
    api.post.mockResolvedValue({ data: { sucesso: true, dados: payload } });
    const resposta = await cadastrarVeiculo(payload);
    expect(resposta).toEqual({ sucesso: true, dados: payload });
    expect(api.post).toHaveBeenCalledWith('/veiculos', payload);
  });
});
