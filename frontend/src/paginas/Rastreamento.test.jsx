// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Rastreamento from './Rastreamento';
import { obterUltimaPosicao } from '../api/rastreamento';
import { obterConfiguracoes } from '../api/configuracoes';
vi.mock('../api/rastreamento', () => ({ obterUltimaPosicao: vi.fn() }));
vi.mock('../componentes/HistoricoRastreamento', () => ({ default: () => null }));
vi.mock('../componentes/MapaTrajeto', () => ({ default: ({ modo }) => <div aria-label={modo === 'posicao' ? 'Mapa da última posição' : 'Mapa do trajeto'} /> }));
vi.mock('../api/configuracoes', () => ({ obterConfiguracoes: vi.fn().mockResolvedValue({ intervaloAtualizacao: 5 }) }));
const resposta = {
  veiculo: { placa: 'TESTE01', marca: 'TESTE', modelo: 'SIMULACAO', cliente: 'Teste' },
  localizacao: { latitude: -15.79, longitude: -47.88, coordenadas: '-15.79, -47.88', velocidade: 12, status: 'Em movimento', dataHora: '2026-10-26T12:00:00Z' },
};
beforeEach(() => obterConfiguracoes.mockResolvedValue({ intervaloAtualizacao: 5 }));
afterEach(() => { cleanup(); vi.useRealTimers(); vi.resetAllMocks(); });
const abrir = () => render(<MemoryRouter initialEntries={['/rastreamento?placa=TESTE01']}><Rastreamento /></MemoryRouter>);
it('identifica a simulação e oferece o mapa da posição consultada', async () => {
  obterUltimaPosicao.mockResolvedValue(resposta);
  abrir();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  expect((await screen.findByRole('status')).textContent).toContain('posições fictícias');
  expect(screen.getByRole('link', { name: 'Ver posição no mapa' }).getAttribute('href')).toContain('mlat=-15.79');
  expect(screen.getByLabelText('Mapa da última posição')).toBeTruthy();
});
it('atualiza a cada cinco segundos e interrompe ao desmarcar', async () => {
  vi.useFakeTimers(); obterUltimaPosicao.mockResolvedValue(resposta); abrir();
  await act(async () => fireEvent.click(screen.getByRole('checkbox')));
  expect(obterUltimaPosicao).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(5000));
  expect(obterUltimaPosicao).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('checkbox'));
  await act(async () => vi.advanceTimersByTime(10000));
  expect(obterUltimaPosicao).toHaveBeenCalledTimes(2);
});
it('descarta a resposta anterior quando a placa é alterada', async () => {
  let resolver; obterUltimaPosicao.mockReturnValue(new Promise((resolve) => { resolver = resolve; })); abrir();
  fireEvent.click(screen.getByRole('button', { name: 'Consultar' }));
  fireEvent.change(screen.getByPlaceholderText(/Digite a placa/), { target: { value: 'OUTRO01' } });
  await act(async () => resolver(resposta));
  expect(screen.queryByRole('status')).toBeNull();
});
