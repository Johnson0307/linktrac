// src/config.js
const safeImportMetaEnv = () => {
  try {
    // Em testes, import.meta pode não estar totalmente disponível.
    return import.meta?.env || {};
  } catch {
    return {};
  }
};

const env = safeImportMetaEnv();

export const CONFIG = {
  API_URL: env?.VITE_API_URL || 'http://localhost:5000/api',

  GEOCODIFICACAO: {
    LIMITE_POR_SEGUNDO: 1,
    USAR: (import.meta.env && import.meta.env.VITE_GEO_PROVIDER) || 'nominatim', // opções: nominatim | openrouteservice | google

    NOMINATIM_URL: 'https://nominatim.openstreetmap.org/reverse',
    OPENROUTE_KEY: (import.meta.env && import.meta.env.VITE_OPENROUTE_KEY) || '',
    GOOGLE_MAPS_KEY: (import.meta.env && import.meta.env.VITE_GOOGLE_MAPS_KEY) || '',
  },
};
