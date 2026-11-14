import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Veiculo = require('../src/models/Veiculo');
const Localizacao = require('../src/models/Localizacao');
const Usuario = require('../src/models/Usuario');
const tracking = require('../src/controllers/rastreamentoController');
const vehicles = require('../src/controllers/veiculoController');
const auth = require('../src/controllers/authController');
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
afterEach(() => vi.restoreAllMocks());
describe('validação dos fluxos', () => {
  it('recebe posição somente para o veículo de origem identificado pelo dispositivo', async () => {
    const id = '507f1f77bcf86cd799439013';
    const find = vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{ _id: id }] });
    const create = vi.spyOn(Localizacao, 'create').mockResolvedValue({ veiculoId: id });
    const res = response();
    await tracking.atualizarPosicao(
      { body: { placa: 'ABC1234', veiculoId: id, latitude: -23, longitude: -46 } },
      res
    );
    expect(find).toHaveBeenCalledWith({ placa: 'ABC1234', _id: id });
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ veiculoId: id }));
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it('não duplica telemetria entre cadastros independentes da mesma placa', async () => {
    vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [{ _id: 'a' }, { _id: 'b' }] });
    const create = vi.spyOn(Localizacao, 'create');
    const res = response();
    await tracking.atualizarPosicao(
      { body: { placa: 'ABC1234', latitude: -23, longitude: -46, velocidade: 10 } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(409);
    expect(create).not.toHaveBeenCalled();
  });
  it.each([
    { velocidade: 'abc' },
    { velocidade: true },
    { endereco: {} },
    { latitude: null },
    { latitude: '' },
    { latitude: ' ' },
    { latitude: true },
    { latitude: {} },
    { latitude: 'abc' },
  ])('rejeita telemetria inválida %j', async (campos) => {
    const create = vi.spyOn(Localizacao, 'create');
    const res = response();
    await tracking.atualizarPosicao(
      { body: { placa: 'ABC1234', latitude: -23, longitude: -46, ...campos } },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('consulta apenas veículo próprio ou explicitamente espelhado', async () => {
    const find = vi.spyOn(Veiculo, 'find').mockReturnValue({ limit: async () => [] });
    const res = response();
    await tracking.consultarUltimaPosicao(
      { params: { placa: ' abc1234 ' }, user: { clienteId: 'cliente' } },
      res
    );
    expect(find).toHaveBeenCalledWith({
      placa: 'ABC1234',
      $or: [{ clienteId: 'cliente' }, { clientesEspelhados: 'cliente' }],
    });
    expect(res.status).toHaveBeenCalledWith(404);
  });
  it('normaliza placa e grava uma única posição com velocidade ausente como sem sinal', async () => {
    const find = vi
      .spyOn(Veiculo, 'find')
      .mockReturnValue({ limit: async () => [{ _id: 'veiculo' }] });
    const create = vi.spyOn(Localizacao, 'create').mockResolvedValue({});
    const res = response();
    await tracking.atualizarPosicao(
      { body: { placa: ' abc1234 ', latitude: -23, longitude: -46 } },
      res
    );
    expect(find).toHaveBeenCalledWith({ placa: 'ABC1234' });
    expect(create).toHaveBeenCalledOnce();
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'Sem sinal', veiculoId: 'veiculo' })
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
  it('rejeita campos de veículo com tipo incorreto', async () => {
    const create = vi.spyOn(Veiculo, 'create');
    const res = response();
    await vehicles.cadastrarVeiculo(
      {
        user: { clienteId: 'cliente' },
        body: { placa: 123, marca: {}, modelo: true, ano: 'Infinity', nomeCliente: [] },
      },
      res
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(create).not.toHaveBeenCalled();
  });
  it('não permite criar espelhamentos pelo cadastro comum', async () => {
    const create = vi.spyOn(Veiculo, 'create').mockResolvedValue({});
    const res = response();
    await vehicles.cadastrarVeiculo(
      {
        user: { clienteId: 'origem' },
        body: {
          placa: 'ABC1234',
          marca: 'Fiat',
          modelo: 'Uno',
          ano: 2020,
          nomeCliente: 'Origem',
          clienteId: 'outra',
          clientesEspelhados: ['invasor'],
        },
      },
      res
    );
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ clienteId: 'origem' }));
    expect(create.mock.calls[0][0]).not.toHaveProperty('clientesEspelhados');
  });
  it('normaliza email de login', async () => {
    const find = vi.spyOn(Usuario, 'findOne').mockResolvedValue(null);
    const res = response();
    await auth.login({ body: { email: ' TESTE@EXEMPLO.COM ', senha: 'senha' } }, res);
    expect(find).toHaveBeenCalledWith({ email: 'teste@exemplo.com', documentoLogin: { $exists: false } });
    expect(res.status).toHaveBeenCalledWith(401);
  });
});
