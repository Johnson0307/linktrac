import { expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { calcular, competenciaSeguinte, validarPlano } = require('../src/services/previaCobranca');

it('soma preços em centavos por veículo e por função', () => {
  const valores = validarPlano({ rastreamento: 1499, telemetria: 305, roteirizacao: 550 });
  expect(calcular(valores, 4).totalCentavos).toBe(9416);
  expect(calcular(valores, 5).itens[1]).toMatchObject({ id: 'telemetria', quantidade: 5, subtotalCentavos: 1525 });
  expect(calcular(valores, 0).totalCentavos).toBe(0);
});

it('calcula a próxima competência no horário de Brasília, inclusive na virada de ano', () => {
  expect(competenciaSeguinte(new Date('2026-12-01T01:00:00Z'))).toBe('2026-12');
  expect(competenciaSeguinte(new Date('2026-12-01T03:00:00Z'))).toBe('2027-01');
});

it.each([
  { rastreamento: 0, telemetria: 10, telemetria_completa: 20 },
  { rastreamento: -1 },
  { rastreamento: 10.5 },
  { rastreamento: '100' },
  { rastreamento: 10, outro: 20 },
  { roteirizacao: 20 },
])('recusa planos inválidos', plano => {
  expect(() => validarPlano(plano)).toThrow();
});
