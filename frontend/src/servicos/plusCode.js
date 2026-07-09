// src/servicos/plusCode.js
// Usamos a biblioteca open-location-code → instale: npm install open-location-code
import OLC from 'open-location-code';

export const PlusCodeServico = {
  // Gera Plus Code a partir de latitude e longitude
  gerar: (lat, lng) => {
    if (!lat || !lng) return null;
    return OLC.encode(lat, lng);
  },

  // Converte Plus Code de volta para coordenadas
  decodificar: (codigo) => {
    if (!OLC.isValid(codigo)) return null;
    const area = OLC.decode(codigo);
    return { lat: area.latitudeCenter, lng: area.longitudeCenter };
  },

  // Verifica se é um código válido
  valido: (codigo) => OLC.isValid(codigo),
};
