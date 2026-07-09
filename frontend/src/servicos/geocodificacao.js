// src/servicos/geocodificacao.js
import { CONFIG } from '../config';
import { filaGeocodificacao } from './filaRequisicoes';

export const GeocodificacaoServico = {
  async obterEndereco(lat, lng) {
    if (!lat || !lng) return null;

    return filaGeocodificacao.adicionar(async () => {
      switch (CONFIG.GEOCODIFICACAO.USAR) {
        case 'nominatim':
          return this.usarNominatim(lat, lng);
        case 'openrouteservice':
          return this.usarOpenRoute(lat, lng);
        case 'google':
          return this.usarGoogle(lat, lng);
        default:
          return null;
      }
    });
  },

  async usarNominatim(lat, lng) {
    const url = `${CONFIG.GEOCODIFICACAO.NOMINATIM_URL}?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
    const res = await fetch(url);
    const dados = await res.json();
    return dados?.display_name || 'Endereço não encontrado';
  },

  async usarOpenRoute(lat, lng) {
    if (!CONFIG.GEOCODIFICACAO.OPENROUTE_KEY) return null;
    const url = `https://api.openrouteservice.org/geocode/reverse?point.lat=${lat}&point.lon=${lng}&api_key=${CONFIG.GEOCODIFICACAO.OPENROUTE_KEY}`;
    const res = await fetch(url);
    const dados = await res.json();
    return dados?.features?.[0]?.properties?.label || 'Endereço não encontrado';
  },

  async usarGoogle(lat, lng) {
    if (!CONFIG.GEOCODIFICACAO.GOOGLE_MAPS_KEY) return null;
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${CONFIG.GEOCODIFICACAO.GOOGLE_MAPS_KEY}`;
    const res = await fetch(url);
    const dados = await res.json();
    return dados?.results?.[0]?.formatted_address || 'Endereço não encontrado';
  },
};
