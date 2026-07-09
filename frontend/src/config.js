// src/config.js
export const CONFIG = {
  API_URL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  GEOCODIFICACAO: {
    LIMITE_POR_SEGUNDO: 1,
    USAR: 'nominatim', // opções: nominatim | openrouteservice | google
    NOMINATIM_URL: 'https://nominatim.openstreetmap.org/reverse',
    OPENROUTE_KEY: import.meta.env.VITE_OPENROUTE_KEY || '',
    GOOGLE_MAPS_KEY: import.meta.env.VITE_GOOGLE_MAPS_KEY || '',
  },
};
