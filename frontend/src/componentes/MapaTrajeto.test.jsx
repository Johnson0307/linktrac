// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import L from 'leaflet';
import MapaTrajeto from './MapaTrajeto';
import { criarCamadasMapa } from './camadasMapa';

const svg = L.Browser.svg;
afterEach(() => { cleanup(); L.Browser.svg = svg; vi.unstubAllEnvs(); vi.restoreAllMocks(); });

it('habilita satélite e trânsito da TomTom com uma única chave de navegador', () => {
  vi.stubEnv('VITE_MAP_SATELLITE_TILE_URL', '');
  vi.stubEnv('VITE_MAP_TRAFFIC_TILE_URL', '');
  vi.stubEnv('VITE_TOMTOM_API_KEY', '');
  expect(criarCamadasMapa().fundos['Satélite']).toBeUndefined();
  expect(criarCamadasMapa().sobreposicoes['Trânsito']).toBeUndefined();
  vi.stubEnv('VITE_TOMTOM_API_KEY', 'chave-teste');
  const tiles = vi.spyOn(L, 'tileLayer');
  const { fundos, sobreposicoes } = criarCamadasMapa();
  expect(tiles).toHaveBeenCalledWith(expect.stringContaining('/satellite/tile/{z}/{x}/{y}?apiVersion=2&key=chave-teste'), expect.any(Object));
  expect(tiles).toHaveBeenCalledWith(expect.stringContaining('/flow/raster/tile/{z}/{x}/{y}?apiVersion=2&key=chave-teste'), expect.any(Object));
  expect(fundos['Satélite'].getAttribution()).toContain('Maxar');
  expect(sobreposicoes['Trânsito'].getAttribution()).toContain('TomTom');
});

it('permite trocar o fundo e alternar o trajeto, as posições e as cercas', () => {
  L.Browser.svg = true;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(380);
  vi.stubEnv('VITE_MAP_SATELLITE_TILE_URL', 'https://example.invalid/satelite/{z}/{x}/{y}.png');
  vi.stubEnv('VITE_MAP_TRAFFIC_TILE_URL', 'https://example.invalid/transito/{z}/{x}/{y}.png');
  const posicoes = [
    { latitude: -15.79, longitude: -47.88, dataHora: '2026-11-11T12:00:00Z' },
    { latitude: -15.78, longitude: -47.87, dataHora: '2026-11-11T12:05:00Z' },
  ];
  const cercas = [{ nome: 'Garagem', latitude: -15.79, longitude: -47.88, raioMetros: 300 }];
  const { container, rerender } = render(<MapaTrajeto posicoes={posicoes} cercas={cercas} />);
  expect(screen.getByRole('button', { name: 'Camadas do mapa' })).toBeTruthy();
  expect(screen.getByLabelText('Ruas')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Satélite'));
  fireEvent.click(screen.getByLabelText('Trânsito'));
  expect(screen.getByLabelText('Satélite')).toBeChecked();
  expect(screen.getByLabelText('Trânsito')).toBeChecked();
  expect(screen.getByLabelText('Posições registradas')).toBeChecked();
  fireEvent.click(screen.getByLabelText('Trajeto'));
  fireEvent.click(screen.getByLabelText('Cercas virtuais'));
  expect(container.querySelector('path[stroke="#0066CC"]')).toBeNull();
  expect(container.querySelector('path[stroke="#6D28D9"]')).toBeTruthy();
  rerender(<MapaTrajeto posicoes={[...posicoes]} cercas={cercas} />);
  expect(screen.getByLabelText('Satélite')).toBeChecked();
  expect(screen.getByLabelText('Trajeto')).not.toBeChecked();
  expect(screen.getByLabelText('Cercas virtuais')).toBeChecked();
});

it('move e remove o marcador de replay sem recriar o mapa', () => {
  L.Browser.svg = true;
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(380);
  const posicoes = [{ latitude: -15.79, longitude: -47.88 }, { latitude: -15.78, longitude: -47.87 }];
  const { container, rerender } = render(<MapaTrajeto posicoes={posicoes} posicaoReplay={posicoes[0]} />);
  const marcador = container.querySelector('.marcador-replay');
  expect(marcador).toBeTruthy();
  const caminho = marcador.getAttribute('d');
  rerender(<MapaTrajeto posicoes={posicoes} posicaoReplay={posicoes[1]} />);
  expect(container.querySelector('.marcador-replay')).toBe(marcador);
  expect(marcador.getAttribute('d')).not.toBe(caminho);
  rerender(<MapaTrajeto posicoes={posicoes} posicaoReplay={null} />);
  expect(container.querySelector('.marcador-replay')).toBeNull();
});
