// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import HistoricoRastreamento from './HistoricoRastreamento';
import { obterHistorico } from '../api/rastreamento';
vi.mock('../api/rastreamento', () => ({ obterHistorico: vi.fn() }));
vi.mock('./MapaTrajeto', () => ({ default: ({ posicoes }) => <div>Mapa com {posicoes.length} pontos</div> }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const dados = { dados: [{ _id: '1', latitude: -15, longitude: -47, velocidade: 12, status: 'Em movimento', dataHora: '2026-10-26T12:00:00Z' }], quantidade: 1, limitado: false };
it('exibe tabela e mapa do veículo selecionado', async () => {
  obterHistorico.mockResolvedValue(dados); render(<HistoricoRastreamento placa="TESTE01" veiculoId="id" />);
  expect(await screen.findByText('Mapa com 1 pontos')).toBeTruthy();
  expect(screen.getByText('12 km/h')).toBeTruthy();
  expect(obterHistorico).toHaveBeenCalledWith('TESTE01', { veiculoId: 'id' });
});
it('filtra por período com conversão do horário local e limpa o filtro', async () => {
  obterHistorico.mockResolvedValue(dados); render(<HistoricoRastreamento placa="TESTE01" />);
  await screen.findByText('1 posições encontradas.');
  fireEvent.change(screen.getByLabelText('Início do período'), { target: { value: '2026-10-26T09:00' } });
  fireEvent.click(screen.getByRole('button', { name: 'Consultar histórico' }));
  await waitFor(() => expect(obterHistorico).toHaveBeenLastCalledWith('TESTE01', expect.objectContaining({ inicio: new Date('2026-10-26T09:00').toISOString() })));
  await screen.findByText('1 posições encontradas.');
  fireEvent.click(screen.getByRole('button', { name: 'Limpar período' }));
  await waitFor(() => expect(obterHistorico).toHaveBeenLastCalledWith('TESTE01', { veiculoId: undefined }));
});
it('trata ausência de posições e falha na API sem manter histórico anterior', async () => {
  obterHistorico.mockResolvedValueOnce({ dados: [], quantidade: 0 }).mockRejectedValueOnce({ mensagem: 'Acesso recusado.' });
  render(<HistoricoRastreamento placa="TESTE01" />);
  expect(await screen.findByText('Nenhuma posição encontrada neste período.')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar histórico' }));
  expect((await screen.findByRole('alert')).textContent).toBe('Acesso recusado.');
});
it('descarta resposta de outro veículo após mudança da seleção', async () => {
  let resolver;
  obterHistorico.mockReturnValueOnce(new Promise((resolve) => { resolver = resolve; })).mockResolvedValueOnce({ dados: [], quantidade: 0 });
  const { rerender } = render(<HistoricoRastreamento placa="TESTE01" />);
  rerender(<HistoricoRastreamento placa="OUTRO01" />);
  await screen.findByText('Nenhuma posição encontrada neste período.');
  resolver(dados);
  await waitFor(() => expect(screen.queryByText('Mapa com 1 pontos')).toBeNull());
});
