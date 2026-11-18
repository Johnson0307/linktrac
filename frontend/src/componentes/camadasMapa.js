import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export function criarCamadasMapa() {
  const ruas = L.tileLayer(import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  });
  const chaveTomTom = import.meta.env.VITE_TOMTOM_API_KEY?.trim();
  const autenticarTomTom = chaveTomTom && `apiVersion=2&key=${encodeURIComponent(chaveTomTom)}`;
  const satelitePersonalizado = import.meta.env.VITE_MAP_SATELLITE_TILE_URL?.trim();
  const transitoPersonalizado = import.meta.env.VITE_MAP_TRAFFIC_TILE_URL?.trim();
  const satelite = satelitePersonalizado || (autenticarTomTom &&
    `https://api.tomtom.com/maps/orbis/display/satellite/tile/{z}/{x}/{y}?${autenticarTomTom}`);
  const transito = transitoPersonalizado || (autenticarTomTom &&
    `https://api.tomtom.com/maps/orbis/traffic/flow/raster/tile/{z}/{x}/{y}?${autenticarTomTom}&style=light&tileSize=256`);
  const fundos = { Ruas: ruas };
  const sobreposicoes = {};
  if (satelite) fundos['Satélite'] = L.tileLayer(satelite, {
    maxZoom: 19,
    crossOrigin: satelitePersonalizado ? false : 'anonymous',
    attribution: import.meta.env.VITE_MAP_SATELLITE_ATTRIBUTION || (satelitePersonalizado ? '' : '© TomTom, Maxar'),
  });
  if (transito) sobreposicoes['Trânsito'] = L.tileLayer(transito, {
    maxZoom: 19,
    crossOrigin: transitoPersonalizado ? false : 'anonymous',
    zIndex: 5,
    attribution: import.meta.env.VITE_MAP_TRAFFIC_ATTRIBUTION || (transitoPersonalizado ? '' : '© TomTom'),
  });
  return { fundos, sobreposicoes };
}

export function adicionarControleCamadas(mapa, fundos, sobreposicoes, opcoes) {
  const controle = L.control.layers(fundos, sobreposicoes, opcoes).addTo(mapa);
  const botao = controle.getContainer().querySelector('.leaflet-control-layers-toggle');
  botao.title = 'Camadas do mapa';
  botao.setAttribute('aria-label', 'Camadas do mapa');
}
