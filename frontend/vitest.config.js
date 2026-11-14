import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Para evitar instabilidades do pipeline do Vite/Vitest no seu ambiente,
    // rodamos em Node (sem jsdom).
    environment: 'node',
    globals: true,
    setupFiles: ['src/setupTests.js'],

    // Execução sequencial e sem opções legadas para compatibilidade com Vitest v4.
    pool: 'forks',

    deps: {
      inline: ['axios'],
    },
  },
});
