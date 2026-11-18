// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Dashboard from './Dashboard';
import api from '../api/api';
vi.mock('../api/api', () => ({ default: { get: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: () => ({ user: { nome: 'Johnson', role: 'admin', clienteId: 'empresa' } }) }));
const dados = { frotaReal: 0, emMovimento: 0, veiculosComAtencao: 0, servicosRegistrados: 0, semComunicacao: 0, simulados: [{ id: 'demo', placa: 'TESTE01' }], atualizadoEm: '2026-10-27T12:00:00Z' };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const abrir = () => render(<MemoryRouter><Dashboard /></MemoryRouter>);
it('abre o mapa da frota em satélite quando configurado e permite voltar para Ruas', async () => {
  vi.stubEnv('VITE_MAP_SATELLITE_TILE_URL', 'https://example.invalid/satelite/{z}/{x}/{y}.png');
  api.get.mockResolvedValue({ data: { dados } });
  try {
    abrir();
    await screen.findByText('Nenhum veículo real cadastrado ainda');
    expect(screen.getByRole('radio', { name: 'Satélite' }).checked).toBe(true);
    const ruas = screen.getByRole('radio', { name: 'Ruas' });
    fireEvent.click(ruas);
    expect(ruas.checked).toBe(true);
    expect(screen.getByRole('radio', { name: 'Satélite' }).checked).toBe(false);
  } finally {
    vi.unstubAllEnvs();
  }
});
it('informa o estado vazio e mantém o veículo de teste separado', async () => {
  api.get.mockResolvedValue({ data: { dados } }); abrir();
  expect(await screen.findByText('Nenhum veículo real cadastrado ainda')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Dados da empresa' }).getAttribute('href')).toBe('/clientes');
  expect(screen.getByRole('link', { name: 'Consultar TESTE01' }).getAttribute('href')).toContain('veiculoId=demo');
  expect(within(screen.getByRole('article', { name: 'Frota real' })).getByText('0')).toBeTruthy();
  expect(screen.queryByText('Visão demonstrativa')).toBeNull();
});
it('mostra os dados retornados e permite atualizar o painel', async () => {
  api.get.mockResolvedValue({ data: { dados: { ...dados, frotaReal: 2, emMovimento: 1 } } }); abrir();
  await waitFor(() => expect(within(screen.getByRole('article', { name: 'Frota real' })).getByText('2')).toBeTruthy());
  expect(screen.queryByText('Nenhum veículo real cadastrado ainda')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Atualizar painel' }));
  await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
});
it('mostra veículos com e sem GPS e permite expandir e recolher o mapa', async () => {
  const veiculosMapa = [
    { id: 'a', placa: 'ABC1D23', cliente: 'Empresa A', posicao: { latitude: -15.8, longitude: -47.9, dataHora: dados.atualizadoEm, recente: false } },
    { id: 'b', placa: 'DEF4G56', cliente: 'Empresa B', posicao: null },
  ];
  api.get.mockResolvedValue({ data: { dados: { ...dados, frotaReal: 2, veiculosMapa } } });
  abrir();
  expect(await screen.findByText('1 de 2 veículos com posição')).toBeTruthy();
  fireEvent.click(screen.getByTitle('ABC1D23'));
  expect(screen.getByRole('link', { name: 'ABC1D23' }).getAttribute('href')).toContain('veiculoId=a');
  expect(screen.getByText(/Empresa A · Última posição conhecida/)).toBeTruthy();
  expect(screen.getByText('Veículos sem posição registrada (1)')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Expandir mapa' }));
  expect(screen.getByRole('button', { name: 'Recolher mapa' }).getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(screen.getByRole('button', { name: 'Expandir mapa' }).getAttribute('aria-expanded')).toBe('false');
});
it('não apresenta contagens zero nem estado vazio se o banco falhar', async () => {
  api.get.mockRejectedValue({ response: { data: { mensagem: 'Banco indisponível.' } } }); abrir();
  expect((await screen.findByRole('alert')).textContent).toContain('Banco indisponível.');
  expect(within(screen.getByRole('article', { name: 'Frota real' })).getByText('—')).toBeTruthy();
  expect(screen.queryByText('Nenhum veículo real cadastrado ainda')).toBeNull();
});
