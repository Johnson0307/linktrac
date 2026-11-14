import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const { gerarKml, medirTrajeto } = require('../src/operacao/trajetoRelatorio');

const p = (hora, longitude, outros = {}) => ({
  latitude: -15.8, longitude, dataHora: new Date(`2026-11-12T${hora}:00Z`), ...outros,
});

it('separa lacunas e pontos inválidos sem somar a distância entre os trechos', () => {
  const { resumo, trechos } = medirTrajeto([
    p('10:00', -47.9), p('10:01', -47.899), p('10:07', -47.89),
    p('10:08', -47.889), p('10:09', -47.888, { status: 'Sem sinal' }),
    p('10:10', -47.887), p('10:11', -47.886), p('10:12', -46),
  ]);
  expect(resumo).toMatchObject({ pontosValidos: 7, descartados: 1, interrupcoes: 3, saltos: 1, intervalos: 3, trechos: 3 });
  expect(resumo.distanciaKm).toBeCloseTo(0.321, 2);
  expect(trechos.map(t => t.length)).toEqual([2, 2, 2]);
});

it('usa longitude antes da latitude e escapa a referência do circuito no KML', () => {
  const dados = medirTrajeto([p('10:00', -47.9), p('10:01', -47.899)]);
  dados.resumo = { ...dados.resumo, placa: 'ABC1D23', circuito: 'Rota & coleta <1>',
    inicio: '2026-11-12T10:00:00Z', fim: '2026-11-12T11:00:00Z' };
  const kml = gerarKml(dados);
  expect(kml).toContain('xmlns="http://www.opengis.net/kml/2.2"');
  expect(kml).toContain('Rota &amp; coleta &lt;1&gt;');
  expect(kml).toContain('<coordinates>-47.90000000,-15.80000000 -47.89900000,-15.80000000</coordinates>');
  expect(kml).toContain('<begin>2026-11-12T10:00:00.000Z</begin>');
});

it('não apresenta zero de quilometragem nem arquivo quando só há um ponto válido', () => {
  const dados = medirTrajeto([p('10:00', -47.9), p('10:01', -47.899, { fonte: 'simulado' })]);
  expect(dados.resumo.distanciaKm).toBeNull();
  expect(() => gerarKml(dados)).toThrow('posições consecutivas suficientes');
});
