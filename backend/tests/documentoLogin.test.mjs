import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const documentos = require('../src/services/documentoLogin');
const Usuario = require('../src/models/Usuario');
const auth = require('../src/controllers/authController');
const usuarios = require('../src/controllers/usuarioController');
const clientes = require('../src/controllers/clienteController');

const resposta = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn() });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

it.each([
  ['529.982.247-25', '52998224725'],
  ['11.222.333/0001-81', '11222333000181'],
  ['12.abc.345/01de-35', '12ABC34501DE35'],
  ['111.111.111-11', null],
  ['529.982.247-24', null],
  ['12.ABC.345/01DE-36', null],
])('valida e normaliza %s', (valor, esperado) => {
  expect(documentos.normalizarDocumento(valor)).toBe(esperado);
});

it('autentica uma conta nova pelo documento e preserva a busca por e-mail para contas antigas', async () => {
  vi.stubEnv('JWT_SECRET', 'segredo-de-teste');
  const usuario = { _id: '1', email: 'contato@example.invalid', compararSenha: vi.fn().mockResolvedValue(true) };
  const buscar = vi.spyOn(Usuario, 'findOne').mockResolvedValueOnce(usuario).mockResolvedValueOnce(null);
  const comDocumento = resposta();
  await auth.login({ body: { identificador: '12.abc.345/01de-35', senha: 'teste' } }, comDocumento);
  expect(buscar).toHaveBeenNthCalledWith(1, { documentoLogin: '12ABC34501DE35' });
  expect(comDocumento.json.mock.calls[0][0].dados.usuario).not.toHaveProperty('documentoLogin');
  const comEmail = resposta();
  await auth.login({ body: { identificador: usuario.email, senha: 'teste' } }, comEmail);
  expect(buscar).toHaveBeenNthCalledWith(2, { email: usuario.email, documentoLogin: { $exists: false } });
  expect(comEmail.status).toHaveBeenCalledWith(401);
});

it('recusa cadastros pela API sem documento válido', async () => {
  vi.stubEnv('LINKTRAC_CLIENT_ID', 'central');
  const req = {
    user: { role: 'admin', clienteId: 'central' },
    body: { nome: 'Teste', nomeEmpresa: 'Empresa', slug: 'empresa', email: 'contato@example.invalid', senha: 'senha-de-teste' },
  };
  for (const criar of [auth.register, usuarios.criarUsuario, clientes.criar]) {
    const res = resposta();
    await criar(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ mensagem: expect.stringContaining('CPF ou CNPJ') }));
  }
});
