// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import ReplayTrajeto from './ReplayTrajeto';

vi.mock('./MapaTrajeto', () => ({ default: ({ posicaoReplay }) => <span data-testid="marcador">{posicaoReplay?._id}</span> }));
afterEach(() => { cleanup(); vi.useRealTimers(); });

const ponto = (id, minutos, status) => ({
  _id: id, dataHora: new Date(Date.UTC(2026, 0, 1, 12, minutos)).toISOString(),
  latitude: -15.8, longitude: -47.9, velocidade: 20, status,
});
const botao = name => screen.getByRole('button', { name });
const marcador = () => screen.getByTestId('marcador').textContent;
const tick = duracao => act(() => vi.advanceTimersByTime(duracao));

it('reproduz em ordem, pausa, permite avançar pela barra e reinicia ao reproduzir no fim', () => {
  vi.useFakeTimers();
  render(<ReplayTrajeto posicoes={[ponto('terceiro', 2), ponto('primeiro', 0), ponto('segundo', 1)]} />);
  fireEvent.click(botao('Replay do trajeto'));
  expect(marcador()).toBe('primeiro');
  fireEvent.click(botao('Reproduzir'));
  tick(1000);
  expect(marcador()).toBe('segundo');
  fireEvent.click(botao('Pausar'));
  tick(5000);
  expect(marcador()).toBe('segundo');
  fireEvent.change(screen.getByRole('slider'), { target: { value: 2 } });
  expect(marcador()).toBe('terceiro');
  fireEvent.click(botao('Reproduzir'));
  expect(marcador()).toBe('primeiro');
});

it('ajusta o ritmo, sinaliza lacuna sem GPS e encerra a reprodução no último ponto', () => {
  vi.useFakeTimers();
  render(<ReplayTrajeto posicoes={[ponto('primeiro', 0), ponto('segundo', 1), ponto('sem-sinal', 3, 'Sem sinal'), ponto('ultimo', 10)]} />);
  fireEvent.click(botao('Replay do trajeto'));
  fireEvent.change(screen.getByLabelText('Velocidade do replay'), { target: { value: 120 } });
  fireEvent.click(botao('Reproduzir'));
  tick(499);
  expect(marcador()).toBe('primeiro');
  tick(1);
  expect(marcador()).toBe('segundo');
  tick(800);
  expect(marcador()).toBe('ultimo');
  expect(screen.getByText(/mais de 5 minutos/i)).toBeTruthy();
  expect(botao('Reproduzir')).toBeTruthy();
  fireEvent.click(botao('Fechar replay'));
  expect(marcador()).toBe('');
});

it('mantém o mapa sem controles se houver somente uma posição válida', () => {
  render(<ReplayTrajeto posicoes={[ponto('valido', 0), ponto('sem-sinal', 1, 'Sem sinal')]} />);
  expect(screen.queryByRole('button', { name: 'Replay do trajeto' })).toBeNull();
});
