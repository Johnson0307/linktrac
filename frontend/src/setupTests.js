// setupTests.js
// Garante que import.meta.env exista durante testes (vitest/jsdom)
// e evita dependência do runtime do Vite.

const envMock = {
  // Campos usados tipicamente no frontend
  VITE_API_URL: 'http://localhost:5000/api',
};

try {
  // Evita tentar escrever em `import.meta` diretamente (alguns bundlers travam).
  // A ideia é apenas garantir que `CONFIG`/API_URL tenha um fallback durante os testes.
  // (O frontend já usa fallback em api.js.)
  if (!globalThis.__LINKTRAC_ENV__) globalThis.__LINKTRAC_ENV__ = {};
  Object.assign(globalThis.__LINKTRAC_ENV__, envMock);
} catch {
  // ignore
}
