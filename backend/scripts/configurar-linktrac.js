const dns = require('node:dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const path = require('node:path');
const fs = require('node:fs/promises');
const { Writable } = require('node:stream');
const readline = require('node:readline/promises');
const mongoose = require('mongoose');
const { configurarLinktrac, atualizarConfiguracao } = require('../src/services/configurarLinktrac');
const envPath = path.resolve(__dirname, '../.env');
require('dotenv').config({ path: envPath, quiet: true });

async function main() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new Error('Execute esta configuração em um terminal interativo do VS Code.');
  if (!process.env.MONGO_URI)
    throw new Error('Configure MONGO_URI no arquivo backend/.env antes de continuar.');
  if (!process.env.JWT_SECRET)
    throw new Error('Configure JWT_SECRET no arquivo backend/.env antes de continuar.');
  if (process.env.LINKTRAC_CLIENT_ID)
    throw new Error('A empresa Linktrac já está configurada. Nenhuma conta foi alterada.');
  await fs.access(envPath, require('node:fs').constants.W_OK);
  let ocultar = false;
  const output = new Writable({
    write(chunk, encoding, callback) {
      if (!ocultar) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const terminal = readline.createInterface({ input: process.stdin, output, terminal: true });
  const perguntar = async (texto, segredo = false) => {
    const resposta = terminal.question(texto);
    ocultar = segredo;
    try {
      return await resposta;
    } finally {
      ocultar = false;
      if (segredo) process.stdout.write('\n');
    }
  };
  let senha;
  let confirmacao;
  let cadastro;
  try {
    process.stdout.write('Verificando a conexão com o banco antes de solicitar o cadastro...\n');
    await mongoose.connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 });
    const nome =
      (await perguntar('Nome do administrador [Administrador Linktrac]: ')).trim() ||
      'Administrador Linktrac';
    const emailPadrao = process.env.LINKTRAC_ADMIN_EMAIL || '';
    const email =
      (await perguntar(`E-mail${emailPadrao ? ` [${emailPadrao}]` : ''}: `)).trim() || emailPadrao;
    process.stdout.write(`\nAdministrador: ${nome}\nE-mail usado para entrar: ${email}\n\n`);
    senha = await perguntar('Defina a senha (mínimo 12 caracteres; não será exibida): ', true);
    confirmacao = await perguntar('Confirme a senha: ', true);
    if (senha !== confirmacao)
      throw new Error('As senhas não coincidem. Nenhuma conta foi criada.');
    cadastro = await configurarLinktrac({
      nome,
      email,
      senha,
      clienteConfigurado: process.env.LINKTRAC_CLIENT_ID,
    });
    try {
      const conteudo = await fs.readFile(envPath, 'utf8');
      await fs.writeFile(envPath, atualizarConfiguracao(conteudo, cadastro.clienteId), 'utf8');
    } catch {
      throw new Error(
        `A conta foi criada, mas não foi possível salvar a configuração. Configure LINKTRAC_CLIENT_ID=${cadastro.clienteId} no backend/.env. Não repita o cadastro.`
      );
    }
    process.stdout.write(
      `\nEmpresa Linktrac e administrador criados. Login: ${cadastro.email}\nReinicie o backend e entre no sistema para acessar Espelhamentos.\n`
    );
  } finally {
    senha = undefined;
    confirmacao = undefined;
    terminal.close();
    await mongoose.disconnect();
  }
}

main().catch((erro) => {
  if (['ECONNREFUSED', 'ENOTFOUND', 'ETIMEOUT', 'ESERVFAIL'].includes(erro.code)) {
    process.stderr.write(
      'Não foi possível localizar o banco pelo DNS. Confira o endereço atual do cluster no MongoDB Atlas e atualize MONGO_URI no backend/.env. Nenhuma conta foi criada.\n'
    );
    process.exitCode = 1;
    return;
  }
  // Não imprime erros de conexão ou documentos que possam conter credenciais.
  const conhecido = !erro.name || erro.name === 'Error';
  process.stderr.write(
    `${conhecido ? erro.message : 'Não foi possível concluir a configuração. Verifique a conexão com o MongoDB e o suporte a transações. Nenhuma senha foi registrada em logs.'}\n`
  );
  process.exitCode = 1;
});
