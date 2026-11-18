const router = require('express').Router();
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Veiculo = require('../models/Veiculo');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { Dispositivo } = require('./modelos');
const { id, data } = require('./validacao');
const { atualizarVinculoDeEquipamento } = require('./chips');
const { consultarTac } = require('./baseTac');
const { Configuracao, padroes } = require('./configuracao');
const { estadoComunicacao } = require('./saudeDispositivo');

const vinculoSchema = new mongoose.Schema({
  clienteId: mongoose.Schema.Types.ObjectId,
  cliente: String,
  veiculoId: mongoose.Schema.Types.ObjectId,
  placa: String,
  veiculo: String,
  nome: String,
  fabricante: String,
  modelo: String,
  codigoExterno: String,
  garantiaAte: String,
}, { _id: false });

const eventoSchema = new mongoose.Schema({
  dispositivoId: { type: mongoose.Schema.Types.ObjectId, required: true },
  tipo: { type: String, required: true, enum: ['cadastro', 'edicao', 'transferencia', 'desativacao', 'exclusao'] },
  dataHora: { type: Date, default: Date.now, required: true },
  usuario: String,
  origem: vinculoSchema,
  destino: vinculoSchema,
});
eventoSchema.index({ 'origem.clienteId': 1, _id: -1 });
eventoSchema.index({ 'destino.clienteId': 1, _id: -1 });
eventoSchema.index({ dispositivoId: 1, _id: -1 });
const Evento = mongoose.model('HistoricoDispositivo', eventoSchema);

const rejeitar = (status, mensagem) => {
  throw Object.assign(new Error(mensagem), { status });
};

const tratar = (acao) => async (req, res) => {
  try {
    await acao(req, res);
  } catch (e) {
    const mensagem = e.code === 11000 ? 'Este código externo já está cadastrado para este tipo de recepção.'
      : e.status ? e.message : 'Não foi possível concluir a operação do equipamento.';
    return res.status(e.code === 11000 ? 409 : e.status || 503).json({ sucesso: false, mensagem });
  }
};

const escopo = (usuario) => adminDaLinktrac(usuario) ? {} : { clienteId: usuario.clienteId };

async function contexto(clienteId, veiculoId, session, exigirDestino = true) {
  const cliente = await Cliente.findById(clienteId).select('nome ativo').session(session).lean();
  const veiculo = await Veiculo.findOne({ _id: veiculoId, clienteId })
    .select('placa marca modelo').session(session).lean();
  if (exigirDestino && (!cliente || cliente.ativo === false || !veiculo)) {
    rejeitar(404, 'Selecione um veículo da empresa de destino ativa.');
  }
  return { cliente, veiculo };
}

const instantaneo = (d, { cliente, veiculo }) => ({
  clienteId: d.clienteId,
  cliente: cliente?.nome,
  veiculoId: d.veiculoId,
  placa: veiculo?.placa,
  veiculo: veiculo && [veiculo.marca, veiculo.modelo].filter(Boolean).join(' '),
  nome: d.nome,
  fabricante: d.fabricante,
  modelo: d.modelo,
  codigoExterno: d.codigoExterno,
  garantiaAte: d.garantiaAte,
});

async function registrar(session, req, dispositivoId, tipo, origem, destino) {
  await Evento.create([{
    dispositivoId, tipo, origem, destino, usuario: req.user.email || String(req.user.id),
  }], { session });
}

const novoToken = () => crypto.randomBytes(32).toString('hex');
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function dadosCadastro(b) {
  if (!id(b.veiculoId) || typeof b.nome !== 'string' || !b.nome.trim() || b.nome.length > 100) {
    rejeitar(400, 'Informe nome e veículo válidos.');
  }
  const dados = { nome: b.nome.trim(), veiculoId: b.veiculoId };
  if (b.receptorTraccar !== undefined) {
    if (typeof b.receptorTraccar !== 'boolean') rejeitar(400, 'Selecione um tipo de recepção válido.');
    dados.receptorTraccar = b.receptorTraccar;
  }
  for (const campo of ['fabricante', 'modelo', 'codigoExterno']) {
    if (b[campo] === undefined) continue;
    if (typeof b[campo] !== 'string' || b[campo].length > 100) rejeitar(400, 'Confira os dados do equipamento.');
    dados[campo] = b[campo].trim() || undefined;
  }
  if (b.garantiaAte !== undefined) {
    if (b.garantiaAte !== '' && !data(b.garantiaAte)) rejeitar(400, 'Informe uma data de garantia válida.');
    dados.garantiaAte = b.garantiaAte || undefined;
  }
  return dados;
}

function validarReceptor(doc, veiculo) {
  if (!doc.receptorTraccar) return;
  if (!/^\d{15}$/.test(doc.codigoExterno ?? '')) rejeitar(400, 'Informe os 15 dígitos do IMEI para usar o receptor Linktrac.');
  if (veiculo.marca === 'TESTE' && veiculo.modelo === 'SIMULACAO') rejeitar(400, 'Vincule o rastreador a um veículo real para usar o receptor Linktrac.');
}

router.get('/', tratar(async (req, res) => {
  const dados = await Dispositivo.find(escopo(req.user)).populate({ path: 'veiculoId', model: Veiculo, select: 'placa marca modelo', transform: (doc, id) => doc || { _id: id } })
    .populate({ path: 'clienteId', model: Cliente, select: 'nome', transform: (doc, id) => doc || { _id: id } }).sort({ createdAt: -1 }).limit(501).lean();
  const pagina = dados.slice(0, 500);
  const empresas = [...new Set(pagina.map(d => String(d.clienteId?._id)).filter(id))];
  const configs = empresas.length ? await Configuracao.find({ clienteId: { $in: empresas } }).select('clienteId dados.ausenciaMinutos').lean() : [];
  const limites = new Map(configs.map(c => [String(c.clienteId), c.dados?.ausenciaMinutos]));
  const agora = new Date();
  res.set('Cache-Control', 'private, no-store');
  return res.json({ sucesso: true, dados: pagina.map(d => ({ ...d, estadoComunicacao:
    estadoComunicacao(d, limites.get(String(d.clienteId?._id)) ?? padroes.ausenciaMinutos, agora),
  })), limitado: dados.length > 500 });
}));

router.get('/opcoes', tratar(async (req, res) => {
  const empresas = await Cliente.find({
    ativo: { $ne: false },
    ...(adminDaLinktrac(req.user) ? {} : { _id: req.user.clienteId }),
  }).select('nome').sort({ nome: 1 }).lean();
  const clienteId = req.query.clienteId || String(req.user.clienteId);
  const empresa = empresas.find((item) => String(item._id) === clienteId);
  if (!empresa) rejeitar(404, 'Empresa de destino indisponível.');
  const veiculos = await Veiculo.find({ clienteId }).select('placa marca modelo').sort({ placa: 1 }).lean();
  return res.json({ sucesso: true, empresas, veiculos });
}));

router.get('/identificar', tratar(async (req, res) => {
  const { imei } = req.query;
  if (typeof imei !== 'string' || !/^\d{15}$/.test(imei)) {
    rejeitar(400, 'Informe um IMEI com 15 dígitos.');
  }
  res.set('Cache-Control', 'no-store');
  const clienteId = new mongoose.Types.ObjectId(req.user.clienteId);
  const exato = await Dispositivo.findOne({ clienteId, codigoExterno: imei })
    .select('fabricante modelo -_id').lean();
  if (exato?.fabricante?.trim() && exato?.modelo?.trim()) {
    return res.json({ sucesso: true, dados: { ...exato, fonte: 'imei' } });
  }
  const tac = imei.slice(0, 8);
  const identificado = await consultarTac(tac);
  if (identificado) {
    return res.json({ sucesso: true, dados: { ...identificado, fonte: 'base_tac' } });
  }
  const prefixo = new RegExp('^' + tac + '\\d{7}$');
  const modelos = await Dispositivo.aggregate([
    { $match: {
      clienteId, codigoExterno: prefixo,
      fabricante: { $type: 'string' }, modelo: { $type: 'string' },
    } },
    { $project: { fabricante: { $trim: { input: '$fabricante' } }, modelo: { $trim: { input: '$modelo' } } } },
    { $match: { fabricante: { $ne: '' }, modelo: { $ne: '' } } },
    { $group: { _id: { fabricante: '$fabricante', modelo: '$modelo' } } },
    { $limit: 2 },
  ]);
  const dados = modelos.length === 1 ? { ...modelos[0]._id, fonte: 'tac' } : null;
  return res.json({ sucesso: true, dados });
}));

router.get('/historico', tratar(async (req, res) => {
  const { antes, dispositivoId } = req.query;
  if ((antes && !id(antes)) || (dispositivoId && !id(dispositivoId))) rejeitar(400, 'Filtro inválido.');
  const central = adminDaLinktrac(req.user);
  const pertence = (lado) => String(lado?.clienteId) === String(req.user.clienteId);
  const dados = await Evento.find({
    ...(central ? {} : { $or: [{ 'origem.clienteId': req.user.clienteId }, { 'destino.clienteId': req.user.clienteId }] }),
    ...(antes ? { _id: { $lt: antes } } : {}),
    ...(dispositivoId ? { dispositivoId } : {}),
  }).sort({ _id: -1 }).limit(51).lean();
  const pagina = dados.slice(0, 50).map((evento) => {
    if (central) return evento;
    const { usuario, origem, destino, ...publico } = evento;
    return {
      ...publico,
      ...(pertence(origem) || pertence(destino) && !origem ? { usuario } : {}),
      origem: pertence(origem) ? origem : undefined,
      destino: pertence(destino) ? destino : undefined,
    };
  });
  return res.json({ sucesso: true, dados: pagina, proximo: dados.length > 50 ? pagina.at(-1)._id : null });
}));

router.post('/', tratar(async (req, res) => {
  const dados = dadosCadastro(req.body || {});
  const clienteId = req.user.clienteId;
  if (!(await Veiculo.exists({ _id: dados.veiculoId, clienteId }))) {
    rejeitar(404, 'Veículo da empresa não encontrado.');
  }
  const token = novoToken();
  await Promise.all([Dispositivo.init(), Evento.init()]);
  const doc = await mongoose.connection.transaction(async (session) => {
    const vinculo = await contexto(clienteId, dados.veiculoId, session);
    const equipamento = new Dispositivo({ ...dados, clienteId, tokenHash: hashToken(token) });
    validarReceptor(equipamento, vinculo.veiculo);
    if (equipamento.receptorTraccar) equipamento.receptorTraccarDesde = new Date();
    await equipamento.save({ session });
    await registrar(session, req, equipamento._id, 'cadastro', undefined, instantaneo(equipamento, vinculo));
    return equipamento;
  });
  return res.status(201).json({ sucesso: true, dados: { id: doc._id, token, protocolo: doc.protocolo } });
}));

async function alterar(req, tipo) {
  if (!id(req.params.id)) rejeitar(400, 'Equipamento inválido.');
  await Promise.all([Dispositivo.init(), Evento.init()]);
  return mongoose.connection.transaction(async (session) => {
    const doc = await Dispositivo.findOne({ _id: req.params.id, ...escopo(req.user) }).session(session);
    if (!doc) {
      if (tipo === 'exclusao' && await Evento.exists({
        dispositivoId: req.params.id, tipo, ...(adminDaLinktrac(req.user) ? {} : { 'origem.clienteId': req.user.clienteId }),
      }).session(session)) return {};
      rejeitar(404, 'Equipamento não encontrado.');
    }
    const origem = instantaneo(doc, await contexto(doc.clienteId, doc.veiculoId, session, false));
    if (tipo === 'exclusao') {
      await atualizarVinculoDeEquipamento(req, doc, 'equipamento_excluido', session, origem);
      await doc.deleteOne({ session });
      await registrar(session, req, doc._id, tipo, origem);
      return {};
    }
    if (tipo === 'desativacao') {
      if (!doc.ativo) return {};
      await atualizarVinculoDeEquipamento(req, doc, 'equipamento_desativado', session, origem);
      doc.ativo = false;
      await doc.save({ session });
      await registrar(session, req, doc._id, tipo, origem);
      return {};
    }

    const dados = dadosCadastro(req.body || {});
    const clienteId = req.body.clienteId ?? String(doc.clienteId);
    if (!id(clienteId)) rejeitar(400, 'Empresa inválida.');
    const mudouEmpresa = clienteId !== String(doc.clienteId);
    const mudouVinculo = mudouEmpresa || dados.veiculoId !== String(doc.veiculoId);
    const mudouCodigo = Object.hasOwn(dados, 'codigoExterno') && dados.codigoExterno !== doc.codigoExterno;
    if (mudouEmpresa && !adminDaLinktrac(req.user)) rejeitar(403, 'Transferência entre empresas exige a administração Linktrac.');
    if ((req.body.origemClienteId !== undefined && req.body.origemClienteId !== String(doc.clienteId)) ||
        (req.body.origemVeiculoId !== undefined && req.body.origemVeiculoId !== String(doc.veiculoId))) {
      rejeitar(409, 'O vínculo mudou. Atualize a lista antes de transferir.');
    }
    const destino = await contexto(clienteId, dados.veiculoId, session);
    if (mudouVinculo) {
      const destinoChip = mudouEmpresa ? undefined : instantaneo({ ...doc.toObject(), veiculoId: dados.veiculoId }, destino);
      await atualizarVinculoDeEquipamento(req, doc, mudouEmpresa ? 'equipamento_transferido' : 'troca_veiculo', session, origem, destinoChip);
    }
    doc.set({ ...dados, clienteId });
    validarReceptor(doc, destino.veiculo);
    if (!doc.isModified()) return {};
    if (doc.receptorTraccar && (mudouVinculo || mudouCodigo || doc.isModified('receptorTraccar'))) {
      doc.receptorTraccarDesde = new Date();
    }
    const token = mudouEmpresa ? novoToken() : undefined;
    if (mudouEmpresa) doc.tokenHash = hashToken(token);
    if (mudouVinculo || mudouCodigo) {
      doc.set({ ultimaRecepcao: undefined, ultimoGpsEm: undefined, ultimaLeitura: undefined, lacunasRecepcao: undefined, estadoAlimentacao: undefined });
    }
    await doc.save({ session });
    await registrar(session, req, doc._id, mudouVinculo ? 'transferencia' : 'edicao', origem, instantaneo(doc, destino));
    return token ? { id: doc._id, token, protocolo: doc.protocolo } : {};
  });
}

router.put('/:id/desativar', tratar(async (req, res) => {
  await alterar(req, 'desativacao');
  return res.json({ sucesso: true });
}));
router.put('/:id', tratar(async (req, res) =>
  res.json({ sucesso: true, dados: await alterar(req, 'edicao') })));
router.delete('/:id', tratar(async (req, res) => {
  await alterar(req, 'exclusao');
  return res.json({ sucesso: true });
}));

module.exports = router;
