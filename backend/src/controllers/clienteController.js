const Cliente = require('../models/Cliente');
const Usuario = require('../models/Usuario');
const MarcaPortal = require('../models/MarcaPortal');
const mongoose = require('mongoose');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { identificadorValido } = require('../services/acessoVeiculo');
const { modulos, padrao, legado, validarAcessos, limitarAcessos, permite } = require('../services/acessosCliente');
const { normalizarDocumento } = require('../services/documentoLogin');
const { Cadastro, validarDados } = require('../services/cadastroFinanceiro');

const cadastroValido = ({ nome, slug, cnpj }) => typeof nome === 'string' && Boolean(nome.trim()) && nome.length <= 150 &&
  typeof slug === 'string' && Boolean(slug.trim()) && slug.length <= 100 &&
  (cnpj === undefined || typeof cnpj === 'string' && cnpj.length <= 32);

const carteira = user => user.role === 'admin' && user.podeGerenciarCarteira;
const tetoCarteira = user => ({ ...(user.acessos ?? legado), marca: 'bloqueado' });
const excedeTeto = (acessos, teto) => {
  const limitados = limitarAcessos(acessos, teto);
  return modulos.some(({ id }) => acessos[id] !== limitados[id]);
};
const temGestao = user => adminDaLinktrac(user) || carteira(user);

exports.opcoesAcessos = async (req, res) => {
  if (!temGestao(req.user)) return res.status(403).json({ sucesso: false, mensagem: 'Sua conta não administra uma carteira de clientes.' });
  try {
    const central = adminDaLinktrac(req.user);
    const teto = central ? legado : tetoCarteira(req.user);
    const marcasHabilitadas = central ? await MarcaPortal.distinct('clienteId', { habilitada: true }) : [];
    return res.json({ sucesso: true, dados: { modulos, padrao: limitarAcessos(padrao, teto), legado, teto, marcasHabilitadas } });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível consultar as opções de acesso.' });
  }
};

exports.criar = async (req, res) => {
  if (!temGestao(req.user)) return res.status(403).json({ sucesso: false, mensagem: 'Sua conta não administra uma carteira de clientes.' });
  const { nome, slug, cnpj, nomeAdmin, email, senha, acessos, tipo = 'cliente' } = req.body || {};
  const central = adminDaLinktrac(req.user);
  if (!['cliente', 'revendedora'].includes(tipo) || tipo === 'revendedora' && !central) {
    return res.status(403).json({ sucesso: false, mensagem: 'Somente a Linktrac pode cadastrar uma revendedora.' });
  }
  const teto = central ? legado : tetoCarteira(req.user);
  const documentoLogin = normalizarDocumento(req.body?.documentoLogin);
  if (!documentoLogin) return res.status(400).json({ sucesso: false, mensagem: 'Informe um CPF ou CNPJ válido para o acesso do administrador.' });
  const permissoes = acessos === undefined ? limitarAcessos(padrao, teto) : validarAcessos(acessos);
  if (!cadastroValido({ nome, slug, cnpj }) || !permissoes ||
      typeof nomeAdmin !== 'string' || !nomeAdmin.trim() || nomeAdmin.length > 150 ||
      typeof email !== 'string' || email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
      typeof senha !== 'string' || senha.trim().length < 12 || Buffer.byteLength(senha) > 72) {
    return res.status(400).json({ sucesso: false, mensagem: 'Confira o cadastro, os acessos e a senha inicial de pelo menos 12 caracteres (até 72 bytes).' });
  }
  if (excedeTeto(permissoes, teto)) return res.status(403).json({ sucesso: false, mensagem: 'A carteira só pode liberar módulos incluídos no acesso da revendedora.' });
  let cobranca;
  try {
    if (req.body?.cobranca !== undefined) {
      cobranca = validarDados({ ...req.body.cobranca, nome, documento: req.body.cobranca?.documento || cnpj || documentoLogin,
        email: req.body.cobranca?.email || email });
    }
  } catch (e) {
    return res.status(e.status).json({ sucesso: false, mensagem: e.message });
  }
  try {
    await Promise.all([Cliente.init(), Usuario.init()]);
    if (cobranca) await Cadastro.init();
    const cliente = await mongoose.connection.transaction(async session => {
      const [empresa] = await Cliente.create([{ nome, slug, cnpj, tipo,
        acessos: tipo === 'revendedora' ? { ...permissoes, marca: 'configurar' } : permissoes,
        ...(!central ? { revendedoraId: req.user.clienteId } : {}),
      }], { session });
      await Usuario.create([{ nome: nomeAdmin, email, documentoLogin, senha, role: 'admin', clienteId: empresa._id }], { session });
      if (cobranca) await Cadastro.create([{ _id: empresa._id, emissorId: req.user.clienteId, dados: cobranca,
        estado: 'pendente', proximaTentativa: new Date() }], { session });
      return empresa;
    });
    return res.status(201).json({ sucesso: true, dados: cliente });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ sucesso: false, mensagem: 'Identificador do cliente, e-mail ou CPF/CNPJ já cadastrado.' });
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível cadastrar o cliente.' });
  }
};

exports.minhaEmpresa = async (req, res) => {
  try {
    const cliente = await Cliente.findById(req.user.clienteId).lean();
    if (!cliente) {
      return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    }

    return res.json({ sucesso: true, dados: cliente });
  } catch (err) {
    return res.status(500).json({ sucesso: false, mensagem: err.message });
  }
};

exports.listar = async (req, res) => {
  try {
    const central = adminDaLinktrac(req.user);
    const revenda = carteira(req.user);
    const filtro = central ? {} : revenda ? { revendedoraId: req.user.clienteId } : { _id: req.user.clienteId };
    const consulta = Cliente.find(filtro).sort({ nome: 1 });
    const dados = await (central ? consulta.populate('revendedoraId', 'nome acessos') : consulta).lean();
    if (revenda && !central) {
      const teto = tetoCarteira(req.user);
      return res.json({ sucesso: true, dados: dados.map(item => ({ ...item, acessos: limitarAcessos(item.acessos, teto) })) });
    }
    return res.json({ sucesso: true, dados });
  } catch {
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível listar os clientes.' });
  }
};

exports.atualizar = async (req, res) => {
  const { id } = req.params;
  if (!identificadorValido(id)) return res.status(400).json({ sucesso: false, mensagem: 'Cliente inválido.' });
  const central = adminDaLinktrac(req.user);
  const daCarteira = !central && carteira(req.user) && id !== String(req.user.clienteId);
  if (id !== String(req.user.clienteId) && !central && !daCarteira) {
    return res.status(403).json({ sucesso: false, mensagem: 'Acesso negado para este cliente.' });
  }
  const { nome, slug, cnpj, acessos } = req.body || {};
  const alterarAcessos = acessos !== undefined;
  if (alterarAcessos && ((!central && !daCarteira) || id === process.env.LINKTRAC_CLIENT_ID)) {
    return res.status(403).json({ sucesso: false, mensagem: 'Sua conta não pode alterar estes acessos.' });
  }
  const permissoes = alterarAcessos ? validarAcessos(acessos) : undefined;
  if (!cadastroValido({ nome, slug, cnpj }) || alterarAcessos && !permissoes) {
    return res.status(400).json({ sucesso: false, mensagem: 'Confira o nome, o identificador e o CNPJ do cliente.' });
  }
  try {
    const filtro = { _id: id, ...(daCarteira ? { revendedoraId: req.user.clienteId } : {}) };
    const empresa = await Cliente.findOne(filtro).select('tipo revendedoraId').lean();
    if (!empresa) return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    if (!central && !daCarteira && !permite(req.user.acessos, 'empresa', true)) {
      return res.status(403).json({ sucesso: false, mensagem: 'Seu acesso não permite alterar os dados da empresa.' });
    }
    if (alterarAcessos && empresa.revendedoraId) {
      const revenda = daCarteira ? req.user : await Cliente.findOne({ _id: empresa.revendedoraId, tipo: 'revendedora' }).select('acessos').lean();
      if (!revenda || excedeTeto(permissoes, tetoCarteira(revenda))) {
        return res.status(403).json({ sucesso: false, mensagem: 'Os acessos ultrapassam os módulos da revendedora.' });
      }
    }
    const consulta = Cliente.findOneAndUpdate(filtro, { $set: { nome, slug, cnpj,
      ...(alterarAcessos ? { acessos: empresa.tipo === 'revendedora' ? { ...permissoes, marca: 'configurar' } : permissoes } : {}),
    } }, { returnDocument: 'after', runValidators: true });
    const dados = await (central ? consulta.populate('revendedoraId', 'nome acessos') : consulta).lean();
    if (!dados) return res.status(404).json({ sucesso: false, mensagem: 'Cliente não encontrado.' });
    return res.json({ sucesso: true, dados });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ sucesso: false, mensagem: 'Identificador já usado por outro cliente.' });
    return res.status(500).json({ sucesso: false, mensagem: 'Não foi possível atualizar o cliente.' });
  }
};
