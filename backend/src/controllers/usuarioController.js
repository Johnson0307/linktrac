const Usuario = require('../models/Usuario');

const validarUsuario = ({ nome, email, senha, role }) => {
  const erros = [];

  if (!nome || !nome.trim()) erros.push('O nome é obrigatório.');
  if (!email || !email.trim()) erros.push('O e-mail é obrigatório.');
  if (!senha || !senha.trim()) erros.push('A senha é obrigatória.');
  if (senha && senha.length < 6) erros.push('A senha deve ter ao menos 6 caracteres.');
  if (!role || !['admin', 'gestor', 'operador', 'motorista'].includes(role)) {
    erros.push('Role inválida.');
  }

  return erros;
};

exports.listarUsuarios = async (req, res) => {
  try {
    const usuarios = await Usuario.find({ clienteId: req.user.clienteId })
      .select('-senha')
      .sort({ dataCadastro: -1 })
      .lean();

    return res.json({ sucesso: true, quantidade: usuarios.length, dados: usuarios });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.criarUsuario = async (req, res) => {
  try {
    const { nome, email, senha, role } = req.body;
    const payload = {
      nome,
      email: email?.toLowerCase?.().trim(),
      senha,
      role: role || 'operador',
      clienteId: req.user.clienteId,
    };

    const erros = validarUsuario(payload);
    if (erros.length > 0) {
      return res.status(400).json({ sucesso: false, erros });
    }

    const existingUser = await Usuario.findOne({ email: payload.email });
    if (existingUser) {
      return res.status(400).json({ sucesso: false, mensagem: 'E-mail já cadastrado.' });
    }

    const usuario = await Usuario.create(payload);
    const usuarioResponse = {
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      ativo: usuario.ativo,
      clienteId: usuario.clienteId,
      dataCadastro: usuario.dataCadastro,
    };

    return res.status(201).json({ sucesso: true, dados: usuarioResponse });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};

exports.atualizarUsuario = async (req, res) => {
  try {
    const { id } = req.params;
    const { nome, role, ativo, senha } = req.body;

    const usuario = await Usuario.findOne({ _id: id, clienteId: req.user.clienteId });
    if (!usuario) {
      return res.status(404).json({ sucesso: false, mensagem: 'Usuário não encontrado.' });
    }

    if (nome) usuario.nome = nome.trim();
    if (role && ['admin', 'gestor', 'operador', 'motorista'].includes(role)) {
      usuario.role = role;
    }
    if (typeof ativo === 'boolean') {
      usuario.ativo = ativo;
    }
    if (senha) {
      usuario.senha = senha;
    }

    await usuario.save();

    const usuarioResponse = {
      id: usuario._id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role,
      ativo: usuario.ativo,
      clienteId: usuario.clienteId,
      dataCadastro: usuario.dataCadastro,
    };

    return res.json({ sucesso: true, dados: usuarioResponse });
  } catch (err) {
    return res.status(500).json({ sucesso: false, erro: err.message });
  }
};
