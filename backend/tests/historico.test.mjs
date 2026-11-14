import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Veiculo = require('../src/models/Veiculo');
const Localizacao = require('../src/models/Localizacao');
const { Registro } = require('../src/operacao/modelos');
const { consultarHistorico } = require('../src/controllers/rastreamentoController');
const id = '507f1f77bcf86cd799439013';
const req = (query = {}) => ({ user: { clienteId: 'empresa' }, params: { placa: 'teste01' }, query });
const res = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
afterEach(() => vi.restoreAllMocks());
it('restringe a consulta à empresa proprietária ou espelhada e aplica período e veículo', async () => {
  const find = vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{ _id: id }] });
  const lean = vi.fn().mockResolvedValue([{ _id: 'b' }, { _id: 'a' }]);
  const sort = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean }) });
  const positions = vi.spyOn(Localizacao, 'find').mockReturnValue({ sort });
  const cercas = vi.spyOn(Registro, 'find');
  const response = res();
  await consultarHistorico(req({ veiculoId: id, inicio: '2026-10-26T00:00:00.000Z', fim: '2026-10-26T23:59:00.000Z' }), response);
  expect(find).toHaveBeenCalledWith({ placa: 'TESTE01', _id: id, $or: [{ clienteId: 'empresa' }, { clientesEspelhados: 'empresa' }] });
  expect(positions).toHaveBeenCalledWith({ veiculoId: id, dataHora: { $gte: new Date('2026-10-26T00:00:00Z'), $lte: new Date('2026-10-26T23:59:00Z') } });
  expect(sort).toHaveBeenCalledWith({ dataHora: -1, _id: -1 });
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ dados: [{ _id: 'a' }, { _id: 'b' }], limitado: false }));
  expect(cercas).not.toHaveBeenCalled();
});
it('consulta cercas vigentes apenas para veículo próprio e devolve os dados cartográficos', async () => {
  vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{ _id: id, clienteId: 'empresa' }] });
  vi.spyOn(Localizacao, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) });
  const cerca = { nome: 'Pátio', latitude: -15.8, longitude: -47.9, raioMetros: 500 };
  const buscar = vi.spyOn(Registro, 'find').mockReturnValue({
    select: () => ({ sort: () => ({ limit: () => ({ lean: async () => [{ dados: cerca }] }) }) }),
  });
  const response = res();
  await consultarHistorico(req(), response);
  expect(buscar).toHaveBeenCalledWith(expect.objectContaining({
    clienteId: 'empresa', tipo: 'cercas', 'dados.veiculoId': id, 'dados.ativo': true,
  }));
  expect(response.json).toHaveBeenCalledWith(expect.objectContaining({ cercas: [cerca] }));
});
it('não consulta posições de veículo sem acesso', async () => {
  vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [] });
  const find = vi.spyOn(Localizacao, 'find'); const response = res();
  await consultarHistorico(req(), response);
  expect(response.status).toHaveBeenCalledWith(404); expect(find).not.toHaveBeenCalled();
});
it('exige identificação quando há placas duplicadas', async () => {
  vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{}, {}] });
  const response = res(); await consultarHistorico(req(), response);
  expect(response.status).toHaveBeenCalledWith(409);
});
it.each([
  { veiculoId: 'invalido' }, { inicio: 'ontem' }, { fim: { $gt: '' } },
  { inicio: '2026-10-27T00:00:00Z', fim: '2026-10-26T00:00:00Z' },
])('rejeita filtros inválidos %j', async (query) => {
  const find = vi.spyOn(Veiculo, 'find'); const response = res();
  await consultarHistorico(req(query), response);
  expect(response.status).toHaveBeenCalledWith(400); expect(find).not.toHaveBeenCalled();
});
it('limita respostas a 500 posições e avisa sobre truncamento', async () => {
  vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{ _id: id }] });
  const limit = vi.fn().mockReturnValue({ lean: async () => Array.from({ length: 501 }, (_, i) => ({ _id: i })) });
  vi.spyOn(Localizacao, 'find').mockReturnValue({ sort: () => ({ limit }) });
  const response = res(); await consultarHistorico(req(), response);
  expect(limit).toHaveBeenCalledWith(501);
  expect(response.json.mock.calls[0][0]).toMatchObject({ quantidade: 500, limitado: true });
  expect(response.json.mock.calls[0][0].dados).toHaveLength(500);
});
