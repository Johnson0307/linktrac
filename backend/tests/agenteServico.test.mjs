import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { Config, Analise } = require('../src/operacao/agenteModelos');
const { Registro, Amostra } = require('../src/operacao/modelos');
const Localizacao = require('../src/models/Localizacao');
const Manutencao = require('../src/models/Manutencao');
const { executarAnalise } = require('../src/operacao/agenteServico');
const clienteId = '507f1f77bcf86cd799439011',
  _id = '507f1f77bcf86cd799439012';
afterEach(() => vi.restoreAllMocks());
const cadeia = (dados) => ({
  select() {
    return this;
  },
  sort() {
    return this;
  },
  limit() {
    return this;
  },
  lean: async () => dados,
});
it('coleta dados do veículo próprio, persiste análise sem leituras e identifica simulação', async () => {
  const gps = vi.spyOn(Localizacao, 'find').mockReturnValue(cadeia([]));
  const sensor = vi.spyOn(Amostra, 'find').mockReturnValue(cadeia([]));
  const planos = vi.spyOn(Registro, 'find').mockReturnValue(cadeia([]));
  const servicos = vi.spyOn(Manutencao, 'find').mockReturnValue(cadeia([]));
  vi.spyOn(Config, 'findOne').mockReturnValue(cadeia(null));
  const create = vi.spyOn(Analise, 'create').mockImplementation(async (doc) => doc);
  const r = await executarAnalise({ _id, clienteId, marca: 'TESTE', modelo: 'SIMULACAO' }, 'teste');
  expect(r.resultado).toMatchObject({
    status: 'dados_insuficientes',
    simulado: true,
    quantidade: 0,
  });
  expect(sensor.mock.calls[0][0]).toMatchObject({ veiculoId: _id, clienteId });
  expect(planos.mock.calls[0][0]).toMatchObject({
    clienteId,
    'dados.veiculoId': _id,
    tipo: 'planos',
  });
  expect(servicos).toHaveBeenCalledWith({ clienteId, veiculoId: _id });
  expect(create.mock.calls[0][0]).toMatchObject({
    clienteId,
    veiculoId: _id,
    solicitadoPor: 'teste',
  });
  expect(gps.mock.calls[0][0].dataHora.$gte).toBeInstanceOf(Date);
});
it('monitor seleciona somente veículos ativados explicitamente e não chama IA', async () => {
  const find = vi.spyOn(Config, 'find').mockReturnValue(cadeia([]));
  const fetch = vi.spyOn(globalThis, 'fetch');
  await require('../src/operacao/agenteMonitor').verificar();
  expect(find).toHaveBeenCalledWith({ monitorar: true });
  expect(fetch).not.toHaveBeenCalled();
});
