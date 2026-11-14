// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import L from 'leaflet';
import { atualizarPosicaoMarcador } from './movimentoMarcador';

afterEach(() => vi.unstubAllGlobals());

it('passa por uma posição intermediária e termina na coordenada recebida', () => {
  const quadros = [];
  vi.stubGlobal('requestAnimationFrame', fn => quadros.push(fn));
  const item = {
    marcador: L.marker([-15.8, -47.9]),
    posicao: { recente: true, dataHora: '2026-11-13T12:00:00Z' },
  };
  const destino = { latitude: -15.8, longitude: -47.8995, recente: true, dataHora: '2026-11-13T12:00:05Z' };
  atualizarPosicaoMarcador(item, destino, true);
  quadros.shift()(0);
  quadros.shift()(500);
  expect(item.marcador.getLatLng().lng).toBeCloseTo(-47.89975, 7);
  quadros.shift()(1000);
  expect(item.marcador.getLatLng().lng).toBe(destino.longitude);
  expect(quadros).toHaveLength(0);
});

it('reposiciona direto após uma lacuna no GPS ou com preferência por movimento reduzido', () => {
  const agendar = vi.fn();
  vi.stubGlobal('requestAnimationFrame', agendar);
  const item = {
    marcador: L.marker([-15.8, -47.9]),
    posicao: { recente: true, dataHora: '2026-11-13T12:00:00Z' },
  };
  const destino = { latitude: -15.8, longitude: -47.8995, recente: true, dataHora: '2026-11-13T12:01:05Z' };
  atualizarPosicaoMarcador(item, destino, true);
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
  atualizarPosicaoMarcador(item, { ...destino, longitude: -47.899, dataHora: '2026-11-13T12:01:10Z' }, true);
  expect(item.marcador.getLatLng().lng).toBe(-47.899);
  expect(agendar).not.toHaveBeenCalled();
});
