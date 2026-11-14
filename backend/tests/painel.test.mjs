import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { resumirPainel } = require('../src/services/resumoPainel');
const { consultarPainel } = require('../src/controllers/painelController');
const Veiculo = require('../src/models/Veiculo');
const Localizacao = require('../src/models/Localizacao');
const Manutencao = require('../src/models/Manutencao');
beforeEach(() => vi.spyOn(require('../src/operacao/configuracao').Configuracao, 'findOne').mockReturnValue({ lean: async () => null }));
const agora = new Date('2026-10-27T12:00:00Z');
const carro = (id, extra = {}) => ({ _id: id, clienteId: 'empresa', marca: 'Fiat', modelo: 'Uno', ...extra });
const p = (id, extra = {}) => ({ veiculoId: id, velocidade: 30, latitude: -15, longitude: -47, status: 'Em movimento', dataHora: '2026-10-27T11:59:00Z', ...extra });
afterEach(() => vi.restoreAllMocks());
it('mostra frota vazia e separa TESTE01 sem preencher contagens fictícias', () => {
  const b = resumirPainel([carro('teste', { marca: 'TESTE', modelo: 'SIMULACAO', placa: 'TESTE01' })], [p('teste')], 0, agora);
  expect(b).toMatchObject({ frotaReal: 0, emMovimento: 0, veiculosComAtencao: 0, servicosRegistrados: 0 });
  expect(b.simulados).toEqual([{ id: 'teste', placa: 'TESTE01' }]);
  expect(b.veiculosMapa).toEqual([]);
});
it('distingue movimento recente, posição antiga e veículo ainda sem posição', () => {
  const b = resumirPainel([carro('a'), carro('b'), carro('c')], [p('a'), p('b', { dataHora: '2026-10-26T12:00:00Z' })], 2, agora);
  expect(b).toMatchObject({ frotaReal: 3, emMovimento: 1, semComunicacao: 2, veiculosComAtencao: 2, servicosRegistrados: 2 });
  expect(b.veiculosMapa).toMatchObject([
    { id: 'a', posicao: { latitude: -15, longitude: -47, recente: true } },
    { id: 'b', posicao: { recente: false } },
    { id: 'c', posicao: null },
  ]);
});
it('não usa posição simulada ou futura para indicar movimento real', () => {
  const b = resumirPainel([carro('a'), carro('b')], [p('a', { fonte: 'simulado' }), p('b', { dataHora: '2026-10-27T13:00:00Z' })], 0, agora);
  expect(b.emMovimento).toBe(0); expect(b.semComunicacao).toBe(2);
  expect(b.veiculosMapa.map(v => v.posicao)).toEqual([null, null]);
});
it('conta excesso atual sem duplicar o veículo com atenção', () => {
  const b = resumirPainel([carro('a')], [p('a', { velocidade: 90 })], 0, agora);
  expect(b).toMatchObject({ emMovimento: 1, veiculosComAtencao: 1 });
});
it('restringe veículos à empresa e não consulta serviços de veículos espelhados ou simulados', async () => {
  const find = vi.spyOn(Veiculo, 'find').mockReturnValue({ select: () => ({ lean: async () => [carro('a'), carro('b', { clienteId: 'outra' }), carro('demo', { marca: 'TESTE', modelo: 'SIMULACAO' })] }) });
  const aggregate = vi.spyOn(Localizacao, 'aggregate').mockResolvedValue([]);
  const count = vi.spyOn(Manutencao, 'countDocuments').mockResolvedValue(0);
  const response = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await consultarPainel({ user: { clienteId: 'empresa' } }, response);
  expect(find).toHaveBeenCalledWith({ $or: [{ clienteId: 'empresa' }, { clientesEspelhados: 'empresa' }] });
  expect(aggregate.mock.calls[0][0][0].$match.veiculoId.$in).toEqual(['a', 'b']);
  expect(count).toHaveBeenCalledWith({ clienteId: 'empresa', veiculoId: { $in: ['a'] } });
});
it('retorna indisponibilidade em vez de zeros quando o banco falha', async () => {
  vi.spyOn(Veiculo, 'find').mockImplementation(() => { throw Error('banco'); });
  const response = { json: vi.fn(), status: vi.fn().mockReturnThis() };
  await consultarPainel({ user: { clienteId: 'empresa' } }, response);
  expect(response.status).toHaveBeenCalledWith(503);
  expect(response.json.mock.calls[0][0]).not.toHaveProperty('dados');
});
