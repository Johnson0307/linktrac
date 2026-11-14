const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Usuario = require('../models/Usuario');

const configurarLinktrac = async ({ nome, email, senha, clienteConfigurado }) => {
  if (clienteConfigurado)
    throw new Error('A empresa Linktrac já está configurada. Nenhuma conta foi alterada.');
  if (typeof nome !== 'string' || !nome.trim()) throw new Error('Informe o nome do administrador.');
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw new Error('Informe um e-mail válido.');
  if (typeof senha !== 'string' || senha.length < 12 || Buffer.byteLength(senha, 'utf8') > 72)
    throw new Error('A senha deve ter ao menos 12 caracteres e no máximo 72 bytes.');

  return mongoose.connection.transaction(async (session) => {
    if (await Usuario.findOne({ email: email.trim().toLowerCase() }).session(session)) {
      throw new Error(
        'Este e-mail já possui uma conta. A configuração não transfere nem altera usuários existentes.'
      );
    }
    if (await Cliente.findOne({ slug: 'linktrac' }).session(session)) {
      throw new Error(
        'Já existe uma empresa com o identificador linktrac. É necessário conferir esse cadastro antes de habilitar a administração.'
      );
    }
    const [cliente] = await Cliente.create([{ nome: 'Linktrac', slug: 'linktrac', ativo: true }], {
      session,
    });
    const [usuario] = await Usuario.create(
      [
        {
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          senha,
          role: 'admin',
          clienteId: cliente._id,
          ativo: true,
        },
      ],
      { session }
    );
    return { clienteId: String(cliente._id), email: usuario.email };
  });
};

const atualizarConfiguracao = (conteudo, clienteId) => {
  if (!mongoose.isObjectIdOrHexString(clienteId))
    throw new Error('Identificador da Linktrac inválido.');
  const linhas = conteudo
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(?:export\s+)?LINKTRAC_CLIENT_ID\s*=/.test(linha));
  return `${linhas.join('\n').trimEnd()}\nLINKTRAC_CLIENT_ID=${clienteId}\n`;
};

module.exports = { configurarLinktrac, atualizarConfiguracao };
