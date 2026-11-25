import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), push = require('../src/services/pushMotorista');
const { Notificacao } = require('../src/operacao/modelos');
const Usuario = require('../src/models/Usuario'), Cliente = require('../src/models/Cliente'), Motorista = require('../src/models/Motorista');
const empresa = '507f1f77bcf86cd799439011', usuario = '507f1f77bcf86cd799439012', motorista = '507f1f77bcf86cd799439013';
const instalacao = '507f1f77-bcf8-4cd7-9943-901199439011';
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('token de push protegido é vinculado ao contexto e não aparece em claro', () => {
  vi.stubEnv('INTEGRACOES_CHAVE_CRIPTOGRAFIA', '1'.repeat(64));
  const segredo = 'ExpoPushToken[destino_ficticio]', valor = push.proteger(segredo, empresa);
  expect(valor).not.toContain(segredo); expect(push.revelar(valor, empresa)).toBe(segredo);
  expect(() => push.revelar(valor, 'outra-empresa')).toThrow();
});
it('configuração incompleta mantém envio externo indisponível', () => {
  vi.stubEnv('PUSH_MOTORISTA_HABILITADO', '0'); expect(push.configuracao().disponivel).toBe(false);
  expect(push.tokenValido('https://invasor.example')).toBe(false);
  expect(push.tokenValido('ExpoPushToken[destino_ficticio]')).toBe(true);
});
it('tela bloqueada e provedor não recebem placa, nome, localização nem ID pessoal', () => {
  const payload = push.mensagemPush('ExpoPushToken[destino_ficticio]');
  expect(payload.data).toEqual({ tipo: 'lembrete_ponto' });
  expect(payload).not.toHaveProperty('latitude'); expect(payload.ttl).toBe(180);
  expect(payload.title).toBe('Linktrac · Confira seu ponto');
});
it('destino HTTPS é fixo, sem redirecionar credencial nem registrar resposta de erro', async () => {
  vi.stubEnv('PUSH_MOTORISTA_EXPO_ACCESS_TOKEN', 'credencial-ficticia');
  const enviar = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ data: [] }) });
  await push.requisitarExpo('send', [], enviar);
  expect(enviar).toHaveBeenCalledWith('https://exp.host/--/api/v2/push/send', expect.objectContaining({ redirect: 'error', method: 'POST' }));
  await expect(push.requisitarExpo('../../outra', [], enviar)).rejects.toMatchObject({ status: 400 });
  expect(enviar).toHaveBeenCalledTimes(1);
});
it.each([[429, true], [503, true], [400, false], [401, false]])('HTTP %i classifica repetição como %s', async (status, temporario) => {
  await expect(push.requisitarExpo('send', [], async () => ({ ok: false, status }))).rejects.toMatchObject({ temporario });
});
it('registro exige motorista ativo na empresa, guarda hash e ignora empresa no corpo', async () => {
  vi.spyOn(Cliente, 'findById').mockReturnValue({ select: () => ({ lean: async () => ({ ativo: true, acessos: { operacao: 'consulta' } }) }) });
  vi.spyOn(Motorista, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [{ _id: motorista }] }) }) });
  const save = vi.spyOn(push.Aparelho, 'findOneAndUpdate').mockResolvedValue({});
  const r = await push.registrar({ id: usuario, clienteId: empresa, role: 'motorista', email: 'sintetico@example.invalid' }, { instalacao, plataforma: 'android', pushAtivo: false, clienteId: 'invasor' });
  expect(r.token).toMatch(/^[a-f0-9]{64}$/); expect(save.mock.calls[0][1].$set.clienteId).toBe(empresa);
  expect(save.mock.calls[0][1].$set.credencialHash).not.toBe(r.token);
  expect(save.mock.calls[0][1].$set).not.toHaveProperty('token');
});
it('credencial revogada ou expirada não concede dados; desconexão permanece possível', async () => {
  vi.spyOn(push.Aparelho, 'findOne').mockReturnValue({ lean: async () => ({ ativo: false, expiraEm: new Date(0) }) });
  const u = vi.spyOn(Usuario, 'findOne');
  await expect(push.autenticar('a'.repeat(64))).rejects.toMatchObject({ status: 401 });
  expect(u).not.toHaveBeenCalled(); expect((await push.autenticar('a'.repeat(64), true)).aparelho).toBeTruthy();
});
it('geração antiga do aparelho não é destinatária de avisos após novo login', async () => {
  expect(await push.aindaValido({ geracao: 'antiga' }, { ativo: true, pushAtivo: true, geracao: 'nova', expiraEm: new Date(Date.now() + 10000) })).toBe(false);
});
it('aceite da Expo aguarda recibo e nunca significa entrega ao motorista', async () => {
  const entrega = { _id: usuario, ticket: instalacao, createdAt: new Date() };
  vi.spyOn(push.Entrega, 'find').mockReturnValue({ limit: () => ({ lean: async () => [entrega] }) });
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ data: { [instalacao]: { status: 'ok' } } }) });
  const update = vi.spyOn(push.Entrega, 'updateOne').mockResolvedValue({});
  await push.conferirRecibos(); expect(update.mock.calls[0][1].$set.estado).toBe('aceito_provedor');
});
it('fila deduplica por evento, aparelho e geração, sem coletar dados do veículo', async () => {
  vi.spyOn(Notificacao, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ _id: usuario, clienteId: empresa, motoristaId: motorista, ocorridoEm: new Date() }] }) }) });
  vi.spyOn(push.Aparelho, 'find').mockReturnValue({ select: () => ({ limit: () => ({ lean: async () => [{ _id: motorista, geracao: 'g1' }] }) }) });
  const criar = vi.spyOn(push.Entrega, 'updateOne').mockResolvedValue({});
  vi.spyOn(Notificacao, 'updateOne').mockResolvedValue({}); await push.prepararFila();
  expect(criar.mock.calls[0][0]).toEqual({ notificacaoId: usuario, aparelhoId: motorista, geracao: 'g1' });
});
