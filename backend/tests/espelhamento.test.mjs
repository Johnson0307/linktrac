import { afterEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Veiculo = require('../src/models/Veiculo');
const Cliente = require('../src/models/Cliente');
const Localizacao = require('../src/models/Localizacao');
const controller = require('../src/controllers/espelhamentoController');
const vehicles = require('../src/controllers/veiculoController');
const tracking = require('../src/controllers/rastreamentoController');
const { linktracAdmin } = require('../src/middlewares/linktracMiddleware');
const origem = '507f1f77bcf86cd799439011';
const destino = '507f1f77bcf86cd799439012';
const veiculoId = '507f1f77bcf86cd799439013';
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
describe('administração Linktrac', () => {
  it.each([
    { role: 'admin', clienteId: destino },
    { role: 'gestor', clienteId: origem },
    undefined,
  ])('nega acesso de administração sem permissão %j', (user) => {
    vi.stubEnv('LINKTRAC_CLIENT_ID', origem);
    const res = response();
    const next = vi.fn();
    linktracAdmin({ user }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
  it('autoriza apenas o administrador da empresa Linktrac configurada', () => {
    vi.stubEnv('LINKTRAC_CLIENT_ID', origem);
    const next = vi.fn();
    linktracAdmin({ user: { role: 'admin', clienteId: origem } }, response(), next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('nega gestão enquanto a empresa Linktrac não estiver configurada', () => {
    vi.stubEnv('LINKTRAC_CLIENT_ID', '');
    const res = response();
    linktracAdmin({ user: { role: 'admin', clienteId: origem } }, res, vi.fn());
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
describe('vínculo explícito com veículo de origem', () => {
  it('concede consulta do mesmo veículo e histórico, depois revoga sem duplicar dados', async () => {
    const veiculo = {
      _id: veiculoId,
      clienteId: origem,
      clientesEspelhados: [],
      placa: 'ABC1234',
      nomeCliente: 'Origem',
    };
    const posicao = { veiculoId, latitude: -23, longitude: -46, velocidade: 10 };
    vi.spyOn(Veiculo, 'findById').mockResolvedValue(veiculo);
    vi.spyOn(Cliente, 'findOne').mockResolvedValue({ _id: destino });
    const update = vi.spyOn(Veiculo, 'updateOne').mockImplementation(async (filtro, alteracao) => {
      if (alteracao.$addToSet) veiculo.clientesEspelhados = [destino];
      else veiculo.clientesEspelhados = [];
      return { modifiedCount: 1 };
    });
    const find = vi.spyOn(Veiculo, 'find').mockImplementation((filtro) => {
      const acesso =
        !filtro.$or ||
        filtro.$or.some(
          (regra) =>
            regra.clienteId === origem ||
            veiculo.clientesEspelhados.includes(regra.clientesEspelhados)
        );
      const registros = acesso && (!filtro._id || filtro._id === veiculoId) ? [veiculo] : [];
      return { limit: async () => registros, sort: async () => registros };
    });
    const buscarPosicao = vi
      .spyOn(Localizacao, 'findOne')
      .mockReturnValue({ sort: () => ({ lean: async () => posicao }) });
    const createVehicle = vi.spyOn(Veiculo, 'create');
    const createPosition = vi.spyOn(Localizacao, 'create');
    const req = {
      user: { clienteId: destino },
      params: { placa: 'ABC1234' },
      query: { veiculoId },
    };
    const semAcesso = response();
    await tracking.consultarUltimaPosicao(req, semAcesso);
    expect(semAcesso.status).toHaveBeenCalledWith(404);
    const grant = response();
    await controller.autorizar({ params: { veiculoId, clienteId: destino } }, grant);
    expect(update).toHaveBeenCalledWith(
      { _id: veiculoId },
      { $addToSet: { clientesEspelhados: destino } }
    );
    expect(grant.json).toHaveBeenCalledWith(expect.objectContaining({ sucesso: true }));
    for (const clienteId of [origem, destino]) {
      const res = response();
      await tracking.consultarUltimaPosicao({ ...req, user: { clienteId } }, res);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          sucesso: true,
          localizacao: expect.objectContaining({ veiculoId }),
        })
      );
    }
    expect(buscarPosicao).toHaveBeenCalledWith({ veiculoId });
    const lista = response();
    await vehicles.listarVeiculos({ user: { clienteId: destino } }, lista);
    expect(lista.json).toHaveBeenCalledWith({ sucesso: true, quantidade: 1, dados: [veiculo] });
    const detalhe = response();
    await vehicles.buscarPorPlaca(req, detalhe);
    expect(detalhe.json).toHaveBeenCalledWith({ sucesso: true, dados: veiculo });
    const revoke = response();
    await controller.revogar({ params: { veiculoId, clienteId: destino } }, revoke);
    expect(update).toHaveBeenLastCalledWith(
      { _id: veiculoId },
      { $pull: { clientesEspelhados: destino } }
    );
    const revogado = response();
    await tracking.consultarUltimaPosicao(req, revogado);
    expect(revogado.status).toHaveBeenCalledWith(404);
    const proprietario = response();
    await tracking.consultarUltimaPosicao({ ...req, user: { clienteId: origem } }, proprietario);
    expect(proprietario.json).toHaveBeenCalledWith(expect.objectContaining({ sucesso: true }));
    expect(createVehicle).not.toHaveBeenCalled();
    expect(createPosition).not.toHaveBeenCalled();
    expect(find).toHaveBeenCalled();
  });
  it('não permite espelhar para a própria proprietária', async () => {
    vi.spyOn(Veiculo, 'findById').mockResolvedValue({ clienteId: origem });
    const update = vi.spyOn(Veiculo, 'updateOne');
    const res = response();
    await controller.autorizar({ params: { veiculoId, clienteId: origem } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(update).not.toHaveBeenCalled();
  });
  it('não permite espelhar para empresa inexistente ou inativa', async () => {
    vi.spyOn(Veiculo, 'findById').mockResolvedValue({ clienteId: origem });
    vi.spyOn(Cliente, 'findOne').mockResolvedValue(null);
    const update = vi.spyOn(Veiculo, 'updateOne');
    const res = response();
    await controller.autorizar({ params: { veiculoId, clienteId: destino } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(update).not.toHaveBeenCalled();
  });
});
