const router = require('express').Router();
const Cliente = require('../models/Cliente');
const MarcaPortal = require('../models/MarcaPortal');
const { authenticate } = require('../middlewares/authMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { identificadorValido } = require('../services/acessoVeiculo');

const rota = acao => async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return await acao(req, res);
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível acessar a identidade visual.' });
  }
};

function imagemValida(logo) {
  if (logo === null) return true;
  if (typeof logo !== 'string' || logo.length > 65600) return false;
  const m = /^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(logo);
  if (!m) return false;
  const bytes = Buffer.from(m[2], 'base64');
  if (bytes.length > 48 * 1024 || bytes.length < 12 || bytes.toString('base64') !== m[2]) return false;
  if (m[1] === 'png') {
    return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.length >= 24 && bytes.readUInt32BE(16) > 0 && bytes.readUInt32BE(16) <= 1024 &&
      bytes.readUInt32BE(20) > 0 && bytes.readUInt32BE(20) <= 1024;
  }
  if (m[1] === 'jpeg') return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
  return bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}

async function marcaPrincipal() {
  const clienteId = process.env.LINKTRAC_CLIENT_ID;
  return clienteId ? MarcaPortal.findOne({ clienteId }).select('nome logo').lean() : null;
}

const apresentar = marca => ({
  nome: marca?.nome || 'Linktrac Prime', logo: marca?.logo || null, padrao: !marca,
});

router.get('/publica', rota(async (_req, res) =>
  res.json({ sucesso: true, dados: apresentar(await marcaPrincipal()) })));

router.get('/atual', authenticate, rota(async (req, res) => {
  const central = adminDaLinktrac(req.user);
  const clienteId = req.user.clienteId;
  const marcaEmpresa = String(clienteId) === process.env.LINKTRAC_CLIENT_ID || req.user.acessos?.marca === 'bloqueado' ? null
    : await MarcaPortal.findOne({ clienteId, habilitada: true }).select('nome logo').lean();
  const marcaRevenda = req.user.revendedoraId && await MarcaPortal.findOne({
    clienteId: req.user.revendedoraId, habilitada: true,
  }).select('nome logo').lean();
  const marca = marcaEmpresa || marcaRevenda || await marcaPrincipal();
  return res.json({
    sucesso: true,
    dados: { ...apresentar(marca), central, podeEditar: central || (req.user.role === 'admin' &&
      (req.user.acessos == null ? Boolean(marcaEmpresa) : req.user.acessos.marca === 'configurar')) },
  });
}));

router.put('/atual', authenticate, rota(async (req, res) => {
  const clienteId = req.user.clienteId;
  const central = adminDaLinktrac(req.user);
  if (req.user.role !== 'admin') {
    return res.status(403).json({ sucesso: false, mensagem: 'Você não pode alterar a identidade visual.' });
  }
  const { nome, logo } = req.body || {};
  if (typeof nome !== 'string' || !nome.trim() || nome.length > 80 || !imagemValida(logo)) {
    return res.status(400).json({ sucesso: false, mensagem: 'Confira o nome e use um logo PNG, JPG ou WebP válido.' });
  }
  const liberada = central || req.user.acessos?.marca === 'configurar';
  const filtro = liberada ? { clienteId } : { clienteId, habilitada: true };
  const valores = { nome: nome.trim(), logo, ...(liberada && !central ? { habilitada: true } : {}) };
  await MarcaPortal.init();
  let marca;
  try {
    marca = await MarcaPortal.findOneAndUpdate(filtro, { $set: valores },
      { upsert: liberada, returnDocument: 'after', runValidators: true }).lean();
  } catch (e) {
    if (e.code !== 11000 || !liberada) throw e;
    marca = await MarcaPortal.findOneAndUpdate(filtro, { $set: valores },
      { returnDocument: 'after', runValidators: true }).lean();
  }
  if (!marca) {
    return res.status(403).json({ sucesso: false, mensagem: 'A personalização visual ainda não foi liberada para a empresa.' });
  }
  return res.json({ sucesso: true, dados: { ...apresentar(marca), central, podeEditar: true } });
}));

router.get('/empresas', authenticate, rota(async (req, res) => {
  if (!adminDaLinktrac(req.user)) return res.status(403).json({ sucesso: false });
  const empresas = await Cliente.find({
    _id: { $ne: req.user.clienteId }, ativo: { $ne: false },
  }).select('nome').sort({ nome: 1 }).lean();
  const habilitadas = new Set((await MarcaPortal.find({ habilitada: true }).distinct('clienteId')).map(String));
  return res.json({
    sucesso: true, dados: empresas.map(e => ({ ...e, habilitada: habilitadas.has(String(e._id)) })),
  });
}));

router.put('/empresas/:id', authenticate, rota(async (req, res) => {
  if (!adminDaLinktrac(req.user)) return res.status(403).json({ sucesso: false });
  const { id } = req.params;
  const { habilitada } = req.body || {};
  if (!identificadorValido(id) || id.toLowerCase() === String(req.user.clienteId) || typeof habilitada !== 'boolean') {
    return res.status(400).json({ sucesso: false, mensagem: 'Selecione uma empresa válida.' });
  }
  const empresa = await Cliente.findOne({ _id: id, ativo: { $ne: false } }).select('nome').lean();
  if (!empresa) return res.status(404).json({ sucesso: false, mensagem: 'Empresa ativa não encontrada.' });
  const filtro = { clienteId: empresa._id };
  const alteracao = { $set: { habilitada }, $setOnInsert: { nome: empresa.nome.slice(0, 80) } };
  await MarcaPortal.init();
  try {
    await MarcaPortal.updateOne(filtro, alteracao, { upsert: habilitada, runValidators: true });
  } catch (e) {
    if (e.code !== 11000) throw e;
    await MarcaPortal.updateOne(filtro, { $set: { habilitada } });
  }
  return res.json({ sucesso: true, dados: { _id: empresa._id, nome: empresa.nome, habilitada } });
}));

module.exports = router;
