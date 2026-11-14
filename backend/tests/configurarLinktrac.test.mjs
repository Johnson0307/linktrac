import { createRequire } from 'node:module';
import { afterEach, describe, it, expect, vi } from 'vitest';
const require = createRequire(import.meta.url);
const mongoose = require('mongoose');
const Cliente = require('../src/models/Cliente');
const Usuario = require('../src/models/Usuario');
const { configurarLinktrac, atualizarConfiguracao } = require('../src/services/configurarLinktrac');
const id = '507f1f77bcf86cd799439011';
const dados = { nome: 'Admin', email: 'admin@example.com', senha: 'senha-de-teste-longa' };
afterEach(() => vi.restoreAllMocks());
describe('configuração inicial da Linktrac', () => {
  it('cria empresa e admin na mesma transação', async () => {
    const session = {};
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation((callback) =>
      callback(session)
    );
    vi.spyOn(Usuario, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(null) });
    vi.spyOn(Cliente, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(null) });
    const criarEmpresa = vi.spyOn(Cliente, 'create').mockResolvedValue([{ _id: id }]);
    const criarUsuario = vi.spyOn(Usuario, 'create').mockResolvedValue([{ email: dados.email }]);
    expect(await configurarLinktrac(dados)).toEqual({ clienteId: id, email: dados.email });
    expect(criarEmpresa).toHaveBeenCalledWith(
      [{ nome: 'Linktrac', slug: 'linktrac', ativo: true }],
      { session }
    );
    expect(criarUsuario).toHaveBeenCalledWith(
      [expect.objectContaining({ role: 'admin', clienteId: id, ativo: true })],
      { session }
    );
  });
  it('não modifica configuração já existente', async () => {
    const transaction = vi.spyOn(mongoose.connection, 'transaction');
    await expect(configurarLinktrac({ ...dados, clienteConfigurado: id })).rejects.toThrow(
      'já está configurada'
    );
    expect(transaction).not.toHaveBeenCalled();
  });
  it('não transforma usuário existente em administrador Linktrac', async () => {
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation((callback) => callback({}));
    vi.spyOn(Usuario, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue({ clienteId: 'outra' }),
    });
    const criar = vi.spyOn(Cliente, 'create');
    await expect(configurarLinktrac(dados)).rejects.toThrow('já possui uma conta');
    expect(criar).not.toHaveBeenCalled();
  });
  it('não assume controle de empresa existente pelo nome', async () => {
    vi.spyOn(mongoose.connection, 'transaction').mockImplementation((callback) => callback({}));
    vi.spyOn(Usuario, 'findOne').mockReturnValue({ session: vi.fn().mockResolvedValue(null) });
    vi.spyOn(Cliente, 'findOne').mockReturnValue({
      session: vi.fn().mockResolvedValue({ _id: id }),
    });
    const criar = vi.spyOn(Usuario, 'create');
    await expect(configurarLinktrac(dados)).rejects.toThrow('Já existe uma empresa');
    expect(criar).not.toHaveBeenCalled();
  });
  it.each([{ senha: 'curta' }, { senha: 'á'.repeat(37) }, { email: 'inválido' }, { nome: ' ' }])(
    'valida credenciais antes de gravar %j',
    async (alteracao) => {
      const transaction = vi.spyOn(mongoose.connection, 'transaction');
      await expect(configurarLinktrac({ ...dados, ...alteracao })).rejects.toThrow();
      expect(transaction).not.toHaveBeenCalled();
    }
  );
  it('configura ID preservando outras variáveis e sem salvar senha', () => {
    const original = 'MONGO_URI=valor-original\nJWT_SECRET=valor-original\nLINKTRAC_CLIENT_ID=\n';
    const atualizado = atualizarConfiguracao(original, id);
    expect(atualizado).toBe(
      `MONGO_URI=valor-original\nJWT_SECRET=valor-original\nLINKTRAC_CLIENT_ID=${id}\n`
    );
    expect(atualizado).not.toContain(dados.senha);
    expect(atualizarConfiguracao(atualizado, id)).toBe(atualizado);
  });
});
