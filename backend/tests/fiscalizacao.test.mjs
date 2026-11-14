import { describe, expect, it } from 'vitest';
import fiscalizacao from '../src/operacao/fiscalizacao.js';

const { indexar, radarAdiante, eventosViarios } = fiscalizacao;
const principal = { id: 'principal', nome: 'Principal', limite: 60, pontos: [[-48.01, -15.8], [-47.99, -15.8]] };
const paralela = { id: 'paralela', nome: 'Paralela', limite: 60, pontos: [[-48.01, -15.8003], [-47.99, -15.8003]] };
const equipamento = {
  id: 'osm:1', nome: 'Radar', longitude: -48, latitude: -15.8,
  fonte: 'OpenStreetMap', azimuteTrafego: 90, limite: 60,
};
const posicao = (longitude, segundos, extras = {}) => ({
  longitude, latitude: -15.8, dataHora: new Date(Date.UTC(2026, 10, 12, 17, 0, segundos)),
  velocidade: 50, fonte: 'dispositivo', ...extras,
});
const agora = posicao(-48.001, 10);
const anterior = posicao(-48.002, 2);
const base = indexar({ vias: [principal, paralela], radares: [equipamento] });

describe('alerta de aproximação de radar', () => {
  it('avisa antes da fiscalização na mesma via, inclusive abaixo do limite', () => {
    expect(radarAdiante(base, agora, anterior)).toMatchObject({ id: equipamento.id, metros: 107, limite: 60 });
    expect(eventosViarios(base, agora, anterior).map(e => e.tipo)).toEqual(['aproximacao_fiscalizacao']);
  });

  it('omite o aviso no sentido contrário, depois do radar e na rua paralela', () => {
    expect(radarAdiante(base, posicao(-47.999, 10), posicao(-47.998, 2))).toBeNull();
    expect(radarAdiante(base, posicao(-47.999, 10), posicao(-48, 2))).toBeNull();
    expect(radarAdiante(base, { ...agora, latitude: -15.8003 }, { ...anterior, latitude: -15.8003 })).toBeNull();
  });

  it('omite o aviso se houver ambiguidade de via, sentido sem confirmação ou histórico insuficiente', () => {
    const viaVizinha = { ...paralela, pontos: [[-48.01, -15.80005], [-47.99, -15.80005]] };
    const baseAmbigua = indexar({ vias: [principal, viaVizinha], radares: [equipamento] });
    const radarSemSentido = { ...equipamento, fonte: 'ANTT', sentido: 'Crescente', azimuteTrafego: undefined };
    expect(radarAdiante(baseAmbigua, agora, anterior)).toBeNull();
    expect(radarAdiante(indexar({ vias: [principal], radares: [radarSemSentido] }), agora, anterior)).toBeNull();
    expect(radarAdiante(base, agora, null)).toBeNull();
    expect(radarAdiante(base, agora, { ...anterior, fonte: 'simulado' })).toBeNull();
    expect(radarAdiante(base, agora, posicao(-48.002, -30))).toBeNull();
  });

  it('aceita o sentido duplo informado pela ANTT, sem presumir limite ausente', () => {
    const radar = { ...equipamento, fonte: 'ANTT', sentido: 'Crescente/Decrescente', azimuteTrafego: undefined, limite: null };
    const baseDupla = indexar({ vias: [principal], radares: [radar] });
    expect(radarAdiante(baseDupla, posicao(-47.999, 10), posicao(-47.998, 2))).toMatchObject({ limite: null });
  });
});
