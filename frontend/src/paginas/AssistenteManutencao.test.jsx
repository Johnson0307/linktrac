// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AssistenteManutencao from './AssistenteManutencao';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../api/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
function preparar() {
  useAuth.mockReturnValue({ user: { role: 'gestor', clienteId: 'empresa' } });
  api.get.mockImplementation(async (url) => ({
    data:
      url === '/operacao/opcoes'
        ? { veiculos: [{ _id: 'v', placa: 'TESTE01', marca: 'TESTE', modelo: 'SIMULACAO' }] }
        : url.endsWith('/status')
          ? { iaConfigurada: false }
          : url.endsWith('/solicitacoes')
            ? { dados: [] }
            : { config: {}, analise: null },
  }));
}
const resultado = {
  status: 'dados_insuficientes',
  simulado: true,
  quantidade: 0,
  criterio: 'Regras técnicas',
  passos: ['Consultar leituras'],
  achados: [],
  proximas: [],
  ausencias: ['Nenhuma leitura técnica nos últimos sete dias.'],
};
it('perfil comum não consulta dados administrativos do assistente', () => {
  useAuth.mockReturnValue({ user: { role: 'operador' } });
  render(<AssistenteManutencao />);
  expect(screen.getByText(/administradas pelos gestores/)).toBeTruthy();
  expect(api.get).not.toHaveBeenCalled();
  expect(screen.queryByRole('button', { name: 'Analisar veículo' })).toBeNull();
});
it('expõe ausência de IA e gera análise sem inventar medições', async () => {
  preparar();
  api.post.mockResolvedValue({
    data: { dados: { _id: 'a', createdAt: '2026-10-27T12:00:00Z', resultado } },
  });
  render(<AssistenteManutencao />);
  await screen.findByLabelText('Temperatura máxima do motor (°C)');
  await waitFor(() => expect(api.get).toHaveBeenCalledWith('/assistente-manutencao/v'));
  await waitFor(() => expect(screen.queryByText('Consultando análise anterior...')).toBeNull());
  fireEvent.click(screen.getByRole('button', { name: 'Analisar veículo' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/assistente-manutencao/v/analisar'));
  expect(await screen.findByText('Dados insuficientes · SIMULAÇÃO')).toBeTruthy();
  expect(screen.getByText('Nenhuma leitura técnica nos últimos sete dias.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Interpretar evidências com IA' }).disabled).toBe(true);
});
it('salva limites específicos sem reutilizar temperatura de carga', async () => {
  preparar();
  api.put.mockResolvedValue({ data: {} });
  render(<AssistenteManutencao />);
  const input = await screen.findByLabelText('Temperatura máxima do motor (°C)');
  fireEvent.change(input, { target: { value: '103' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar referências' }));
  await waitFor(() =>
    expect(api.put).toHaveBeenCalledWith('/assistente-manutencao/v/config', {
      temperaturaMotorMax: 103,
      tensaoMinima: null,
      monitorar: false,
    })
  );
});
it('falha de análise preserva resultado anterior e mostra erro', async () => {
  preparar();
  api.get.mockImplementation(async (url) => ({
    data:
      url === '/operacao/opcoes'
        ? { veiculos: [{ _id: 'v', placa: 'A' }] }
        : url.endsWith('/status')
          ? { iaConfigurada: false }
          : url.endsWith('/solicitacoes')
            ? { dados: [] }
            : { config: {}, analise: { _id: 'a', createdAt: '2026-10-27T12:00:00Z', resultado } },
  }));
  api.post.mockRejectedValue(new Error());
  render(<AssistenteManutencao />);
  expect(await screen.findByText('Dados insuficientes · SIMULAÇÃO')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Analisar veículo' }));
  expect(await screen.findByRole('alert')).toBeTruthy();
  expect(screen.getByText('Dados insuficientes · SIMULAÇÃO')).toBeTruthy();
});
