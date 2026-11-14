import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resumirAtividade } = require('../src/services/historicoAtividade');
const ponto = (segundos, velocidade, extra = {}) => ({
  dataHora: new Date(Date.UTC(2026, 9, 26, 12, 0, segundos)).toISOString(),
  velocidade, status: velocidade > 5 ? 'Em movimento' : 'Parado', latitude: 0, longitude: segundos / 10000, ...extra,
});
it('agrupa intervalos contíguos sem extrapolar o último registro', () => {
  const resultado = resumirAtividade([ponto(0, 0), ponto(10, 0), ponto(20, 20), ponto(30, 30), ponto(40, 0), ponto(50, 0)]);
  expect(resultado.resumo).toMatchObject({ viagens: 1, paradas: 2, tempoMovimentoSegundos: 20, tempoParadoSegundos: 30 });
  expect(resultado.trechos.map((t) => t.tipo)).toEqual(['parada', 'viagem', 'parada']);
  expect(resultado.trechos[1].velocidadeMaxima).toBe(30);
  expect(resultado.trechos[1].distanciaKm).toBeCloseTo(0.22239, 4);
  expect(resultado.trechos[2].fim).toBe(ponto(50, 0).dataHora);
});
it('interrompe viagens em lacunas e não transforma ausência de comunicação em parada', () => {
  const resultado = resumirAtividade([ponto(0, 20), ponto(10, 30), ponto(1000, 20), ponto(1010, 0)]);
  expect(resultado.resumo).toMatchObject({ viagens: 2, tempoMovimentoSegundos: 20, tempoParadoSegundos: 0 });
  expect(resultado.intervalosDesconhecidos).toBe(1);
  expect(resultado.tempoDesconhecidoSegundos).toBe(990);
});
it('ignora intervalos com velocidade ausente, coordenadas inválidas ou status Sem sinal', () => {
  for (const extra of [{ status: 'Sem sinal' }, { velocidade: null }, { latitude: 100 }, { velocidade: -1 }]) {
    const resultado = resumirAtividade([ponto(0, 20), ponto(10, 0, extra), ponto(20, 20)]);
    expect(resultado.trechos).toEqual([]); expect(resultado.intervalosDesconhecidos).toBe(2);
  }
});
it('trata limite de velocidade e data duplicada sem durações negativas', () => {
  const resultado = resumirAtividade([ponto(0, 5), ponto(0, 5), ponto(10, 6), ponto(20, 0)]);
  expect(resultado.resumo).toMatchObject({ viagens: 1, paradas: 1, tempoParadoSegundos: 10, tempoMovimentoSegundos: 10 });
});
it('não inventa atividade com uma única posição ou histórico vazio', () => {
  expect(resumirAtividade([]).trechos).toEqual([]);
  expect(resumirAtividade([ponto(0, 0)]).trechos).toEqual([]);
});
