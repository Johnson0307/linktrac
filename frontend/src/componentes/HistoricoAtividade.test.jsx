// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import HistoricoAtividade from './HistoricoAtividade';
afterEach(cleanup);
const local = { latitude: -15, longitude: -47, endereco: 'SIMULAÇÃO' };
const atividade = {
  resumo: { viagens: 1, paradas: 1, tempoMovimentoSegundos: 60, tempoParadoSegundos: 30, distanciaKm: 0.5 },
  intervalosDesconhecidos: 1, tempoDesconhecidoSegundos: 600,
  trechos: ['viagem', 'parada'].map((tipo) => ({ tipo, inicio: '2026-10-26T12:00:00Z', fim: '2026-10-26T12:01:00Z', duracaoSegundos: 60, distanciaKm: 0.5, velocidadeMaxima: 30, origem: local, destino: local })),
};
it('exibe estimativas e permite alternar entre viagens e paradas', () => {
  render(<HistoricoAtividade atividade={atividade} limitado />);
  expect(screen.getByText('Viagens e paradas estimadas')).toBeTruthy();
  expect(screen.getByText(/Resumo parcial/)).toBeTruthy();
  expect(screen.getByRole('status').textContent).toContain('intervalos sem dados suficientes');
  expect(screen.getByText('30 km/h')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Paradas (1)' }));
  expect(screen.getByRole('button', { name: 'Paradas (1)' }).getAttribute('aria-pressed')).toBe('true');
  expect(screen.queryByText('30 km/h')).toBeNull();
  expect(screen.getByText('Trechos parados no período consultado')).toBeTruthy();
});
it('explica quando não há pontos suficientes para estimar trechos', () => {
  render(<HistoricoAtividade atividade={{ ...atividade, trechos: [] }} />);
  expect(screen.getByText(/São necessárias pelo menos duas posições/)).toBeTruthy();
});
