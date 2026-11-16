const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const mongoose = require('mongoose');
const { normalizarDocumento } = require('../services/documentoLogin');

const consultarModoCadastro = async (codigo) => {
  if (codigo) return 'codigo';
  return (await Usuario.exists({})) ? 'encerrado' : 'inicial';
};

exports.statusCadastro = async (_req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const modo = await consultarModoCadastro(process.env.REGISTER_SECRET);
    return res.json({ sucesso: true, dados: { modo } });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível consultar a disponibilidade do cadastro.' });
  }
};

const criarToken = (usuario) => {
  const payload = {
    id: usuario._id,
    email: usuario.email,
    role: usuario.role,
    clienteId: usuario.clienteId,
  };

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error('JWT_SECRET não configurado.');
  }

  return jwt.sign(payload, jwtSecret, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

exports.register = async (req, res) => {
  try {
    const { nomeEmpresa, slug, cnpj, nome, email, senha, role, registroSecret } = req.body || {};
    const documentoLogin = normalizarDocumento(req.body?.documentoLogin);

    if (![nomeEmpresa, slug, nome, email, senha].every((valor) => typeof valor === 'string' && valor.trim())) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios faltando.' });
    }

    if (role && !['admin', 'gestor', 'operador', 'motorista'].includes(role)) {
      return res.status(400).json({ sucesso: false, mensagem: 'Perfil de usuário inválido.' });
    }
    if (!documentoLogin) return res.status(400).json({ sucesso: false, mensagem: 'Informe um CPF ou CNPJ válido para entrar.' });
    // Verifica a configuração antes de persistir cliente e usuário.
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ sucesso: false, mensagem: 'JWT_SECRET não configurado.' });
    }

    const registrationSecret = process.env.REGISTER_SECRET;
    if (registrationSecret) {
      if (registroSecret !== registrationSecret) {
        return res.status(403).json({ sucesso: false, mensagem: 'Código de registro inválido.' });
      }
    } else if (await consultarModoCadastro(registrationSecret) === 'encerrado') {
      return res.status(403).json({
        sucesso: false,
        codigo: 'CADASTRO_INICIAL_ENCERRADO',
        mensagem: 'Entre no painel para cadastrar clientes e usuários.',
      });
    }

    const existingCliente = await Cliente.findOne({ slug: slug.trim().toLowerCase() });
    if (existingCliente) {
      return res.status(400).json({ sucesso: false, mensagem: 'Cliente já cadastrado.' });
    }

    const existingUser = await Usuario.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail já está em uso.' });
    }

    await Promise.all([Cliente.init(), Usuario.init()]);
    const usuario = await mongoose.connection.transaction(async session => {
      const [cliente] = await Cliente.create([{ nome: nomeEmpresa.trim(), slug: slug.trim().toLowerCase(), cnpj,
        ...(process.env.LINKTRAC_CLIENT_ID ? { acessos: require('../services/acessosCliente').padrao } : {}),
      }], { session });
      const [admin] = await Usuario.create([{
        nome, email: email.trim().toLowerCase(), documentoLogin, senha, role: role || 'admin', clienteId: cliente._id,
      }], { session });
      return admin;
    });

    const token = criarToken(usuario);

    return res.status(201).json({
      sucesso: true,
      dados: {
        token,
        usuario: {
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role,
          clienteId: usuario.clienteId,
        },
      },
    });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ sucesso: false, mensagem: 'Identificador da empresa, e-mail ou CPF/CNPJ já cadastrado.' });
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { identificador, email, senha } = req.body || {};
    const login = identificador ?? email;
    if (typeof login !== 'string' || !login.trim() || login.length > 250 || typeof senha !== 'string' || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: 'Informe o CPF ou CNPJ e a senha. Contas antigas podem usar o e-mail.' });
    }

    const documento = normalizarDocumento(login);
    const filtro = documento ? { documentoLogin: documento } :
      login.includes('@') ? { email: login.trim().toLowerCase(), documentoLogin: { $exists: false } } : null;
    const usuario = filtro && await Usuario.findOne(filtro);
    if (!usuario || usuario.ativo === false || !(await usuario.compararSenha(senha))) {
      return res.status(401).json({ sucesso: false, mensagem: 'Credenciais inválidas.' });
    }

    const token = criarToken(usuario);

    return res.json({
      sucesso: true,
      dados: {
        token,
        usuario: {
          nome: usuario.nome,
          email: usuario.email,
          role: usuario.role,
          clienteId: usuario.clienteId,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.me = async (req, res) => {
  const usuario = req.user;

  if (!usuario) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
  }

  return res.json({ sucesso: true, dados: usuario });
};
