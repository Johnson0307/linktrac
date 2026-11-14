import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { calcularEventos } = require('../src/services/eventosHistorico');
const p = (min, extra = {}) => ({ dataHora: new Date(Date.UTC(2026, 9, 26, 12, min)).toISOString(), velocidade: 0, ...extra });
it('não infere ignição pela velocidade nem cria excesso no limite de 80', () => {
  const r = calcularEventos([p(0, { velocidade: 80 }), p(1, { velocidade: 0 })], new Date(p(1).dataHora));
  expect(r.ignicao).toEqual([]); expect(r.alertas).toEqual([]);
});
it('marca simulação, estados e mudanças efetivamente recebidos', () => {
  const r = calcularEventos([p(0, { ignicao: false, fonte: 'simulado' }), p(1, { ignicao: true, velocidade: 90, fonte: 'simulado' }), p(2, { ignicao: true })], new Date(p(2).dataHora));
  expect(r.alertas[0]).toMatchObject({ tipo: 'Velocidade acima de 80 km/h', simulado: true });
  expect(r.ignicao).toHaveLength(2); expect(r.ignicao[1]).toMatchObject({ ligada: true, tipo: 'Mudança observada', simulado: true });
});
it('após lacuna, informa estado observado em vez de inventar a hora da mudança', () => {
  const r = calcularEventos([p(0, { ignicao: false }), p(10, { ignicao: true })], new Date(p(20).dataHora));
  expect(r.ignicao[1].tipo).toBe('Estado observado');
  expect(r.alertas.map((a) => a.tipo)).toEqual(['Intervalo sem comunicação', 'Última posição desatualizada']);
});
