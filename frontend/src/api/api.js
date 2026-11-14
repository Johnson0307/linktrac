// src/api/api.js
import axios from 'axios';

// Evita falhas em ambientes de teste: não usamos top-level await.
// setupTests.js injeta globalThis.__LINKTRAC_ENV__.
let API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
try {
  const env = globalThis?.__LINKTRAC_ENV__;
  if (env?.VITE_API_URL) API_URL = env.VITE_API_URL;
} catch {
  // ignore
}

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Ajuda os testes: vitest/jsdom não tem localStorage garantido.
api.interceptors.request.use((config) => {
  try {
    const storage = globalThis?.localStorage;
    const token = storage?.getItem?.('token');

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch {
    // ignore
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const publicAuthRequest = /\/auth\/(login|register)\/?$/.test(error.config?.url || '');
    if (error.response?.status === 401 && !publicAuthRequest) {
      try {
        globalThis?.localStorage?.removeItem?.('token');
      } catch {
        // ignore
      }

      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
