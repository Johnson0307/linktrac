const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');

const criarToken = (usuario) => {
  const payload = {
    id: usuario._id,
    email: usuario.email,
    role: usuario.role,
    clienteId: usuario.clienteId,
  };

  return jwt.sign(payload, process.env.JWT_SECRET || 'linktrac-secret', {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
};

exports.register = async (req, res) => {
  try {
    const { nomeEmpresa, slug, cnpj, nome, email, senha, role, registroSecret } = req.body;

    if (!nomeEmpresa || !slug || !nome || !email || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: 'Dados obrigatórios faltando.' });
    }

    const registrationSecret = process.env.REGISTER_SECRET;
    if (registrationSecret) {
      if (registroSecret !== registrationSecret) {
        return res.status(403).json({ sucesso: false, mensagem: 'Código de registro inválido.' });
      }
    } else {
      const totalUsers = await Usuario.countDocuments();
      if (totalUsers > 0) {
        return res.status(403).json({
          sucesso: false,
          mensagem: 'Registro não está disponível após a configuração inicial.',
        });
      }
    }

    const existingCliente = await Cliente.findOne({ slug: slug.toLowerCase() });
    if (existingCliente) {
      return res.status(400).json({ sucesso: false, mensagem: 'Cliente já cadastrado.' });
    }

    const existingUser = await Usuario.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail já está em uso.' });
    }

    const cliente = await Cliente.create({ nome: nomeEmpresa, slug: slug.toLowerCase(), cnpj });
    const usuario = await Usuario.create({
      nome,
      email: email.toLowerCase(),
      senha,
      role: role || 'admin',
      clienteId: cliente._id,
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
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;
    if (!email || !senha) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail e senha são obrigatórios.' });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase() });
    if (!usuario || !(await usuario.compararSenha(senha))) {
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
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.me = async (req, res) => {
  const usuario = req.user;

  if (!usuario) {
    return res.status(401).json({ sucesso: false, mensagem: 'Não autenticado.' });
  }

  return res.json({ sucesso: true, dados: usuario });
};
