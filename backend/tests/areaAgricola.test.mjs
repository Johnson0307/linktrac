import { expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { prepararTalhao, calcularArea } = require('../src/operacao/areaAgricola');
const { validar } = require('../src/operacao/validacao');
const xy = (x, y) => ({ longitude: x / 111195, latitude: y / 111195 });
const talhao = [xy(0, 0), xy(100, 0), xy(100, 100), xy(0, 100)];
const leitura = (x, y, segundos, alteracoes) => ({
  ...xy(x, y), dataHora: new Date(segundos * 1000), ignicao: true, velocidade: 6, ...alteracoes,
});

it('estima e recorta a faixa no talhão sem contar duas vezes o mesmo trecho', () => {
  const a = leitura(-10, 50, 0);
  const b = leitura(110, 50, 60);
  const c = leitura(-10, 50, 120);
  const resultado = calcularArea(talhao, [a, b, c], 10);
  expect(resultado.areaTalhaoHa).toBeCloseTo(1);
  expect(resultado.areaTrabalhadaHa).toBeCloseTo(0.1);
  expect(resultado.segmentos).toHaveLength(2);
});

it('ignora lacunas, posições sem ignição ligada e passes fora do talhão', () => {
  expect(calcularArea(talhao, [leitura(5, 50, 0), leitura(95, 50, 130)], 10).areaTrabalhadaHa).toBe(0);
  expect(calcularArea(talhao, [leitura(5, 50, 0), leitura(95, 50, 60, { ignicao: null })], 10).areaTrabalhadaHa).toBe(0);
  expect(calcularArea(talhao, [leitura(5, 120, 0), leitura(95, 120, 60)], 10).areaTrabalhadaHa).toBe(0);
});

it('rejeita polígonos cruzados e vértices repetidos', () => {
  expect(() => prepararTalhao([talhao[0], talhao[2], talhao[1], talhao[3]])).toThrow(/cruzar/);
  expect(() => prepararTalhao([talhao[0], talhao[0], talhao[2], talhao[3]])).toThrow(/vértices/);
});

it('permite manutenção apenas por horas e exige o horímetro base, inclusive zero', () => {
  const dados = { veiculoId: '507f1f77bcf86cd799439011', servico: 'Óleo', ultimaData: '2026-10-01', intervaloHoras: 250 };
  expect(validar('planos', dados).erros).toContain('Informe o horímetro da última revisão.');
  expect(validar('planos', { ...dados, ultimoHorimetro: 0 }).erros).toEqual([]);
});
