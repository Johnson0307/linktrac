const mongoose = require('mongoose');
const router = require('express').Router();
const { Dispositivo } = require('./modelos');
const Veiculo = require('../models/Veiculo');
const { id } = require('./validacao');

const oid = mongoose.Schema.Types.ObjectId;
const chipSchema = new mongoose.Schema({
  clienteId: { type: oid, required: true }, iccid: { type: String, required: true }, operadora: String,
  ativo: { type: Boolean, default: true }, dispositivoId: oid,
}, { timestamps: true });
chipSchema.index({ clienteId: 1, iccid: 1 }, { unique: true });
chipSchema.index({ dispositivoId: 1 }, { unique: true, partialFilterExpression: { dispositivoId: { $type: 'objectId' } } });
const Chip = mongoose.model('Chip', chipSchema);
const eventoSchema = new mongoose.Schema({
  clienteId: oid, chipId: oid, tipo: String, usuario: String,
  origem: { type: Object }, destino: { type: Object },
}, { timestamps: true });
eventoSchema.index({ clienteId: 1, chipId: 1, _id: -1 });
const HistoricoChip = mongoose.model('HistoricoChip', eventoSchema);
const escopo = req => ({ clienteId: req.user.clienteId });
const falhar = (status, mensagem) => { throw Object.assign(new Error(mensagem), { status }); };
const tratar = acao => async (req, res) => {
  res.set('Cache-Control', 'private, no-store');
  try {
    return await acao(req, res);
  } catch (e) {
    const mensagem = e.code === 11000 ? 'Este ICCID já está cadastrado ou o equipamento já tem um chip vinculado.'
      : e.status ? e.message : 'Não foi possível concluir a operação do chip.';
    return res.status(e.code === 11000 ? 409 : e.status || 503).json({ sucesso: false, mensagem });
  }
};
const resumo = (d, v) => d && ({ equipamento: d.nome, dispositivoId: d._id, veiculoId: d.veiculoId, placa: v?.placa });
const estado = (chip) => !chip.ativo ? 'inativo' : chip.dispositivoId ? 'em_uso' : 'estoque';

async function registrar(req, chip, tipo, session, origem, destino) {
  await HistoricoChip.create([{ clienteId: chip.clienteId, chipId: chip._id, tipo, origem, destino,
    usuario: req.user.nome || req.user.email || String(req.user.id) }], { session });
}

async function fichaDoVinculo(chip, session) {
  if (!chip.dispositivoId) return undefined;
  const d = await Dispositivo.findOne({ _id: chip.dispositivoId, clienteId: chip.clienteId })
    .select('nome veiculoId').session(session).lean();
  if (!d) return undefined;
  const v = await Veiculo.findOne({ _id: d.veiculoId, clienteId: chip.clienteId }).select('placa').session(session).lean();
  return resumo(d, v);
}

async function atualizarVinculoDeEquipamento(req, dispositivo, tipo, session, origem, destino) {
  const chip = await Chip.findOne({ clienteId: dispositivo.clienteId, dispositivoId: dispositivo._id }).session(session);
  if (!chip) return;
  if (tipo !== 'troca_veiculo') {
    chip.dispositivoId = undefined;
    await chip.save({ session });
  }
  await registrar(req, chip, tipo, session, origem, destino);
}

router.get('/', tratar(async (req, res) => {
  const { antes, situacao, busca } = req.query;
  if ((antes !== undefined && !id(antes)) || (situacao && !['estoque', 'em_uso', 'inativo'].includes(situacao)) ||
      (busca !== undefined && (typeof busca !== 'string' || !/^\d{1,22}$/.test(busca)))) falhar(400, 'Confira os filtros.');
  const dados = await Chip.find({ ...escopo(req), ...(antes ? { _id: { $lt: antes } } : {}),
    ...(busca ? { iccid: { $regex: '^' + busca } } : {}),
    ...(situacao === 'inativo' ? { ativo: false } : {}),
    ...(['estoque', 'em_uso'].includes(situacao) ? { ativo: true, dispositivoId: { $exists: situacao === 'em_uso' } } : {}),
  }).sort({ _id: -1 }).limit(51).lean();
  const pagina = dados.slice(0, 50);
  const equipamentos = await Dispositivo.find({ ...escopo(req), _id: { $in: pagina.map(c => c.dispositivoId).filter(Boolean) } })
    .select('nome veiculoId').lean();
  const veiculos = await Veiculo.find({ ...escopo(req), _id: { $in: equipamentos.map(d => d.veiculoId) } }).select('placa').lean();
  const placas = new Map(veiculos.map(v => [String(v._id), v]));
  const vinculos = new Map(equipamentos.map(d => [String(d._id), resumo(d, placas.get(String(d.veiculoId)))]));
  return res.json({ sucesso: true, dados: pagina.map(c => ({ ...c, situacao: estado(c), vinculo: vinculos.get(String(c.dispositivoId)) })),
    proximo: dados.length > 50 ? pagina.at(-1)._id : null });
}));

router.get('/equipamentos', tratar(async (req, res) => {
  const dados = await Dispositivo.find({ ...escopo(req), ativo: true }).select('nome veiculoId').sort({ nome: 1, _id: 1 }).limit(501).lean();
  const veiculos = await Veiculo.find({ ...escopo(req), _id: { $in: dados.map(d => d.veiculoId) }, ativo: { $ne: false } }).select('placa').lean();
  const placas = new Map(veiculos.map(v => [String(v._id), v]));
  return res.json({ sucesso: true, dados: dados.slice(0, 500).filter(d => placas.has(String(d.veiculoId)))
    .map(d => resumo(d, placas.get(String(d.veiculoId)))), limitado: dados.length > 500 });
}));

router.post('/', tratar(async (req, res) => {
  const { iccid, operadora } = req.body || {};
  if (typeof iccid !== 'string' || !/^\d{18,22}$/.test(iccid) || typeof operadora !== 'string' ||
      !operadora.trim() || operadora.length > 80) falhar(400, 'Informe um ICCID de 18 a 22 dígitos e a operadora.');
  await Promise.all([Chip.init(), HistoricoChip.init()]);
  const chip = await mongoose.connection.transaction(async session => {
    const [cadastro] = await Chip.create([{ ...escopo(req), iccid, operadora: operadora.trim() }], { session });
    await registrar(req, cadastro, 'cadastro', session);
    return cadastro;
  });
  return res.status(201).json({ sucesso: true, dados: chip });
}));

router.get('/:id/historico', tratar(async (req, res) => {
  const { antes } = req.query;
  if (!id(req.params.id) || (antes !== undefined && !id(antes))) falhar(400, 'Filtro inválido.');
  if (!(await Chip.exists({ ...escopo(req), _id: req.params.id }))) falhar(404, 'Chip não encontrado.');
  const eventos = await HistoricoChip.find({ ...escopo(req), chipId: req.params.id, ...(antes ? { _id: { $lt: antes } } : {}) })
    .sort({ _id: -1 }).limit(51).lean();
  return res.json({ sucesso: true, dados: eventos.slice(0, 50), proximo: eventos.length > 50 ? eventos[49]._id : null });
}));

router.patch('/:id', tratar(async (req, res) => {
  const { acao, dispositivoId, vinculoAtual } = req.body || {};
  if (!id(req.params.id) || !['vincular', 'desvincular', 'desativar', 'reativar'].includes(acao) ||
      (acao === 'vincular' && !id(dispositivoId)) || (vinculoAtual !== null && !id(vinculoAtual))) falhar(400, 'Confira a ação e o vínculo atual.');
  await mongoose.connection.transaction(async session => {
    const chip = await Chip.findOne({ ...escopo(req), _id: req.params.id }).session(session);
    if (!chip) falhar(404, 'Chip não encontrado.');
    if ((chip.dispositivoId?.toString() || null) !== vinculoAtual) falhar(409, 'O vínculo mudou. Atualize a lista.');
    if (acao === 'reativar' && chip.ativo || acao === 'desativar' && !chip.ativo ||
        acao === 'desvincular' && !chip.dispositivoId || acao === 'vincular' && String(chip.dispositivoId) === dispositivoId) return;
    if (acao === 'vincular' && !chip.ativo) falhar(409, 'Reative o chip antes de vinculá-lo.');
    const origem = await fichaDoVinculo(chip, session);
    let destino;
    if (acao === 'vincular') {
      // Serializa o vínculo com alterações do equipamento, inclusive transferência e exclusão.
      const d = await Dispositivo.findOneAndUpdate({ ...escopo(req), _id: dispositivoId, ativo: true },
        { $inc: { revisaoVinculoChip: 1 } }, { session, timestamps: false }).select('nome veiculoId').lean();
      const v = d && await Veiculo.findOne({ ...escopo(req), _id: d.veiculoId, ativo: { $ne: false } })
        .select('placa').session(session).lean();
      if (!v) falhar(404, 'Selecione um equipamento ativo da sua empresa.');
      chip.dispositivoId = d._id;
      destino = resumo(d, v);
    } else {
      chip.dispositivoId = undefined;
      if (acao === 'desativar' || acao === 'reativar') chip.ativo = acao === 'reativar';
    }
    await chip.save({ session });
    await registrar(req, chip, acao, session, origem, destino);
  });
  return res.json({ sucesso: true });
}));

module.exports = { router, atualizarVinculoDeEquipamento };
