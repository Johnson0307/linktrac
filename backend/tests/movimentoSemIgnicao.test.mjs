import { expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { detectarMovimentoSemIgnicao } = require('../src/operacao/movimentoSemIgnicao');
const ponto = (segundos, deslocamento, demais = {}) => ({
  dataHora: new Date(Date.UTC(2026, 0, 1) + segundos * 1000), latitude: 0,
  longitude: deslocamento / 111195, velocidade: 10, ignicao: false, ...demais,
});

it('confirma deslocamento em três leituras e evita repetir o alerta durante a sequência', () => {
  const percurso = [ponto(0, 0), ponto(30, 80), ponto(60, 160)];
  expect(detectarMovimentoSemIgnicao(percurso.slice(0, 2))).toBeNull();
  expect(detectarMovimentoSemIgnicao(percurso)).toBe(160);
  expect(detectarMovimentoSemIgnicao([...percurso, ponto(90, 240)])).toBeNull();
  expect(detectarMovimentoSemIgnicao([ponto(90, 240), ponto(120, 240, { ignicao: true }),
    ponto(150, 240), ponto(180, 320), ponto(210, 400)])).toBe(160);
});

it.each([
  [ponto(0, 0), ponto(30, 8), ponto(60, 10)],
  [ponto(0, 0), ponto(30, 100), ponto(60, 5)],
  [ponto(0, 0), ponto(30, 10000), ponto(60, 20000)],
  [ponto(0, 0), ponto(30, 80), ponto(180, 160)],
  [ponto(0, 0), ponto(30, 80, { ignicao: null }), ponto(60, 160)],
  [ponto(0, 0), ponto(30, 80, { status: 'Sem sinal' }), ponto(60, 160)],
  [ponto(0, 0), ponto(30, 80, { velocidade: 0 }), ponto(60, 160)],
])('ignora leituras insuficientes ou incompatíveis', (...pontos) => {
  expect(detectarMovimentoSemIgnicao(pontos)).toBeNull();
});
