const express = require('express');
const crypto = require('node:crypto');
const mongoose = require('mongoose');
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const { catalogo } = require('./catalogo');
const { validar, id } = require('./validacao');
const { Registro, Notificacao, EstadoPneu, Amostra, Gateway } = require('./modelos');
const { Configuracao, campos, padroes, obterConfig, validarConfig } = require('./configuracao');
const Veiculo = require('../models/Veiculo');
const Motorista = require('../models/Motorista');
const Localizacao = require('../models/Localizacao');
const { metrosEntre } = require('./telemetria');
const { avaliarPlanos, avaliarMultas, avisarMultaRegistrada } = require('./automacoes');
const { permite } = require('../services/acessosCliente');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { saudeArquivo } = require('../services/copiarHistoricoArquivo');
const { consultarNumero, salvarNumero } = require('./whatsappBusiness');
const router = express.Router();
const falha = (res, e) => res.status(e.code === 11000 ? 409 : e.status || 503).json({ sucesso: false, mensagem: e.code === 11000 ? 'Código ou posição de pneu já utilizado. Confira os registros existentes.' : e.status ? e.message : 'Não foi possível concluir a operação.' });
const recusar = (message, status = 400) => { const e = new Error(message); e.status = status; throw e; };
const referencias = async (clienteId, tipo, dados) => {
  for (const campo of catalogo[tipo].campos) {
    const value = dados[campo.key]; if (!value) continue;
    let existe = true;
    if (campo.tipo === 'veiculo') existe = await Veiculo.exists({ _id: value, clienteId });
    if (campo.tipo === 'motorista') existe = await Motorista.exists({ _id: value, clienteId });
    if (campo.tipo === 'pneu') existe = await Registro.exists({ _id: value, clienteId, tipo: 'pneus' });
    if (!existe) recusar(`${campo.label} não pertence à sua empresa.`, 404);
  }
};
router.use(authenticate);
router.use('/ocorrencias', require('./ocorrencias'));
router.get('/configuracoes', async (req, res) => {
  try { res.json({ sucesso: true, dados: await obterConfig(req.user.clienteId), campos }); } catch (e) { falha(res, e); }
});
router.use(authorize('admin', 'gestor'));
router.use('/agro', require('./agro'));
const configurarWhatsApp = (acao) => async (req, res) => {
  if (!adminDaLinktrac(req.user)) return res.status(403).json({ sucesso: false, mensagem: 'Acesso restrito à administração Linktrac.' });
  res.set('Cache-Control', 'private, no-store');
  try {
    const dados = await acao(req);
    return res.json({ sucesso: true, dados });
  } catch (e) { return falha(res, e); }
};
router.get('/configuracoes/whatsapp', configurarWhatsApp(req => consultarNumero(req.user.clienteId)));
router.put('/configuracoes/whatsapp', configurarWhatsApp(req => salvarNumero(req.user.clienteId, req.body?.numero)));
router.get('/arquivo-historico', async (req, res) => {
  if (!adminDaLinktrac(req.user)) return res.status(403).json({ sucesso: false, mensagem: 'Acesso restrito à administração central.' });
  res.set('Cache-Control', 'private, no-store');
  try {
    return res.json({ sucesso: true, arquivo: await saudeArquivo() });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Não foi possível consultar a saúde do arquivo.' });
  }
});
router.use('/dispositivos', require('./dispositivos'));
router.use('/tags-ble', require('./tagsBle').router);
router.use('/chips', require('./chips').router);
router.put('/configuracoes', async (req, res) => {
  const resultado = validarConfig(req.body);
  if (resultado.erro) return res.status(400).json({ sucesso: false, mensagem: resultado.erro });
  try {
    await Configuracao.findOneAndUpdate({ clienteId: req.user.clienteId }, { $set: { dados: resultado.dados, atualizadoPor: req.user.email } }, { upsert: true, new: true, runValidators: true });
    return res.json({ sucesso: true, dados: resultado.dados });
  } catch (e) { return falha(res, e); }
});
router.get('/video-eventos', require('./videoEventos').listar);
router.get('/catalogo', (req, res) => res.json({ sucesso: true, dados: catalogo }));
router.get('/telemetria/:veiculoId', async (req, res) => {
  try {
    if (!id(req.params.veiculoId) || !(await Veiculo.exists({ _id: req.params.veiculoId, clienteId: req.user.clienteId }))) recusar('Veículo da empresa não encontrado.', 404);
    const [gps, sensor] = await Promise.all([Localizacao.findOne({ veiculoId: req.params.veiculoId, telemetria: { $exists: true } }).sort({ dataHora: -1 }).lean(), Amostra.findOne({ veiculoId: req.params.veiculoId }).sort({ dataHora: -1 }).lean()]);
    const p = sensor && (!gps || new Date(sensor.dataHora) > new Date(gps.dataHora)) ? sensor : gps;
    if (!p) return res.json({ sucesso: true, dados: null });
    const dados = { dataHora: p.dataHora, recebidoEm: p.recebidoEm, fonte: p.fonte, ignicao: p.ignicao, telemetria: { ...p.telemetria } };
    delete dados.telemetria.identificadorMotorista;
    return res.json({ sucesso: true, dados });
  } catch (e) { return falha(res, e); }
});
router.get('/opcoes', async (req, res) => {
  try {
    const acessos = req.user.acessos;
    const [veiculos, motoristas, pneus] = await Promise.all([
      Veiculo.find({ clienteId: req.user.clienteId }).select('_id placa marca modelo').limit(1000).lean(),
      ['operacao', 'entregas', 'motoristas'].some(modulo => permite(acessos, modulo))
        ? Motorista.find({ clienteId: req.user.clienteId }).select('_id nome').limit(1000).lean() : [],
      permite(acessos, 'operacao')
        ? Registro.find({ clienteId: req.user.clienteId, tipo: 'pneus' }).select('_id dados.codigo').limit(1000).lean() : [],
    ]);
    return res.json({ sucesso: true, veiculos, motoristas, pneus });
  } catch (e) { return falha(res, e); }
});
router.get('/notificacoes', async (req, res) => {
  try { await avaliarPlanos(req.user.clienteId); await avaliarMultas(req.user.clienteId); const dados = await Notificacao.find({ clienteId: req.user.clienteId }).sort({ createdAt: -1 }).limit(500).lean(); res.json({ sucesso: true, dados }); } catch (e) { falha(res, e); }
});
router.put('/notificacoes/:id/lida', async (req, res) => {
  try {
    if (!id(req.params.id)) recusar('Notificação inválida.');
    const doc = await Notificacao.findOneAndUpdate({ _id: req.params.id, clienteId: req.user.clienteId }, { $set: { lida: true } }, { new: true });
    if (!doc) recusar('Notificação não encontrada.', 404);
    return res.json({ sucesso: true, dados: doc });
  } catch (e) { return falha(res, e); }
});
router.get('/gateways', async (req, res) => {
  try { res.json({ sucesso: true, dados: await Gateway.find({ clienteId: req.user.clienteId }).sort({ createdAt: -1 }).limit(100).lean() }); } catch (e) { falha(res, e); }
});
router.post('/gateways', async (req, res) => {
  try {
    if (typeof req.body?.nome !== 'string' || !req.body.nome.trim() || req.body.nome.length > 100) recusar('Informe o nome do gateway.');
    const token = crypto.randomBytes(32).toString('hex');
    const doc = await Gateway.create({ clienteId: req.user.clienteId, nome: req.body.nome.trim(), tokenHash: crypto.createHash('sha256').update(token).digest('hex') });
    return res.status(201).json({ sucesso: true, dados: { id: doc._id, token }, mensagem: 'Credencial de gateway da empresa. Só aceita códigos externos de equipamentos previamente cadastrados nessa empresa.' });
  } catch (e) { return falha(res, e); }
});
router.put('/gateways/:id/desativar', async (req, res) => {
  try {
    if (!id(req.params.id)) recusar('Gateway inválido.');
    if (!(await Gateway.findOneAndUpdate({ _id: req.params.id, clienteId: req.user.clienteId }, { $set: { ativo: false } }))) recusar('Gateway não encontrado.', 404);
    return res.json({ sucesso: true });
  } catch (e) { return falha(res, e); }
});
router.post('/sequenciar', async (req, res) => {
  try {
    const { veiculoId, latitude, longitude, partida, velocidadeMedia = 40 } = req.body || {};
    if (!id(veiculoId) || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || !Number.isFinite(longitude) || Math.abs(longitude) > 180 || !require('./validacao').horario(partida) || !Number.isFinite(velocidadeMedia) || velocidadeMedia < 5 || velocidadeMedia > 120) recusar('Informe veículo, ponto inicial, horário e velocidade média entre 5 e 120 km/h.');
    if (!(await Veiculo.exists({ _id: veiculoId, clienteId: req.user.clienteId }))) recusar('Veículo não encontrado.', 404);
    const registros = await Registro.find({ clienteId: req.user.clienteId, tipo: 'cargas', 'dados.veiculoId': veiculoId, 'dados.status': { $in: ['pendente', 'em_rota'] } }).limit(101).lean();
    if (registros.length > 100) recusar('Selecione uma operação com até 100 entregas pendentes.');
    if (registros.some(r => r.dados.viagemConteinerId)) {
      recusar('Calcule as etapas de contêiner na tela Roteirização de entregas.', 409);
    }
    if (registros.some(r => !Number.isFinite(r.dados.latitude) || !Number.isFinite(r.dados.longitude))) {
      recusar('Confirme as coordenadas das paradas pendentes no TMS antes de sequenciar.', 422);
    }
    const resultado = sequenciar(registros, { latitude, longitude }, partida, velocidadeMedia);
    res.json({ sucesso: true, ...resultado, estimado: true, criterio: 'Vizinho geográfico mais próximo, respeitando espera pela abertura da janela. Sem ruas, trânsito, pedágios ou garantia de ótimo global.' });
  } catch (e) { falha(res, e); }
});
function sequenciar(registros, origem, partida, velocidade) {
  const restantes = [...registros]; const etapas = []; let atual = origem; let tempo = Date.parse(partida); let distanciaKm = 0;
  while (restantes.length) {
    restantes.sort((a, b) => metrosEntre(atual, a.dados) - metrosEntre(atual, b.dados));
    const item = restantes.shift(); const d = item.dados; const distancia = metrosEntre(atual, d) / 1000;
    tempo += distancia / velocidade * 3600000; distanciaKm += distancia;
    if (d.janelaInicio) tempo = Math.max(tempo, Date.parse(d.janelaInicio));
    etapas.push({ id: item._id, codigo: d.codigo, destinatario: d.destinatario, latitude: d.latitude, longitude: d.longitude, distanciaKm: distancia, chegadaEstimada: new Date(tempo).toISOString(), janelaExcedida: Boolean(d.janelaFim && tempo > Date.parse(d.janelaFim)) });
    tempo += (d.minutosServico || 0) * 60000; atual = d;
  }
  return { etapas, distanciaKm, terminoEstimado: new Date(tempo).toISOString() };
}
router.get('/:tipo', async (req, res) => {
  try {
    if (!Object.hasOwn(catalogo, req.params.tipo)) recusar('Área não encontrada.', 404);
    const dados = await Registro.find({ clienteId: req.user.clienteId, tipo: req.params.tipo }).sort({ createdAt: -1 }).limit(501).lean();
    const estados = req.params.tipo === 'pneus' ? await EstadoPneu.find({ clienteId: req.user.clienteId, pneuId: { $in: dados.slice(0, 500).map((d) => d._id) } }).lean() : [];
    for (const estado of estados) {
      let km = estado.kmAcumulados; let horario;
      if (estado.veiculoId) {
        const [gps, sensor] = await Promise.all([Localizacao.findOne({ veiculoId: estado.veiculoId, 'telemetria.odometroKm': { $exists: true } }).sort({ dataHora: -1 }).lean(), Amostra.findOne({ veiculoId: estado.veiculoId, 'telemetria.odometroKm': { $exists: true } }).sort({ dataHora: -1 }).lean()]);
        const p = sensor && (!gps || new Date(sensor.dataHora) > new Date(gps.dataHora)) ? sensor : gps;
        if (p && p.telemetria.odometroKm >= estado.odometroMontagem && new Date(p.dataHora) >= new Date(estado.ultimaData)) { km += p.telemetria.odometroKm - estado.odometroMontagem; horario = p.dataHora; }
        else estado.aguardandoOdometro = true;
      }
      estado.kmEstimados = km; estado.baseOdometroEm = horario;
      const cadastro = dados.find((d) => String(d._id) === String(estado.pneuId))?.dados;
      estado.inspecaoIndicada = Boolean((cadastro?.limiteKm && km >= cadastro.limiteKm) || (cadastro?.sulcoMinimoMm && estado.sulcoMm !== undefined && estado.sulcoMm <= cadastro.sulcoMinimoMm));
    }
    return res.json({ sucesso: true, dados: dados.slice(0, 500), limitado: dados.length > 500, estados });
  } catch (e) { return falha(res, e); }
});
const salvar = (editar) => async (req, res) => {
  try {
    const tipo = req.params.tipo;
    if (!Object.hasOwn(catalogo, tipo)) recusar('Área não encontrada.', 404);
    if (editar && !id(req.params.id)) recusar('Registro inválido.');
    if (editar && tipo === 'movimentacoes') recusar('Movimentações são históricas e não podem ser alteradas.');
    const { erros, dados } = validar(tipo, req.body);
    if (erros.length) recusar(erros.join(' '));
    if (tipo === 'multas' && dados.prazo && dados.prazo < dados.dataInfracao) recusar('O prazo não pode ser anterior à infração.');
    const escopoEdicao = { _id: req.params.id, clienteId: req.user.clienteId, tipo };
    if (editar && tipo === 'cargas') {
      const operacionais = ['viagemConteinerId', 'chegouEm', 'tentativas', 'concluidaEm'];
      if (await Registro.exists({ ...escopoEdicao,
        $or: operacionais.map(campo => ({ [`dados.${campo}`]: { $exists: true } })),
      })) recusar('Consulte a execução da parada na tela Roteirização de entregas.', 409);
      for (const campo of operacionais) escopoEdicao[`dados.${campo}`] = { $exists: false };
    }
    await referencias(req.user.clienteId, tipo, dados);
    await Registro.init();
    let doc;
    if (tipo === 'movimentacoes') doc = await registrarPneu(req.user.clienteId, dados, req.user.email);
    else if (tipo === 'vinculos') doc = await salvarVinculo(req, dados, editar);
    else doc = editar ? await Registro.findOneAndUpdate(escopoEdicao, { $set: { dados } }, { new: true, runValidators: true }) : await Registro.create({ clienteId: req.user.clienteId, tipo, dados, criadoPor: req.user.email });
    if (!doc) recusar('Registro não encontrado.', 404);
    if (tipo === 'multas' && !editar) {
      await avisarMultaRegistrada(doc).catch(() => res.setHeader('X-Linktrac-Automacoes', 'indisponivel'));
    }
    return res.status(editar ? 200 : 201).json({ sucesso: true, dados: doc });
  } catch (e) { return falha(res, e); }
};
async function salvarVinculo(req, dados, editar) {
  return mongoose.connection.transaction(async (session) => {
    // Escritas no veículo e motorista serializam vínculos concorrentes na mesma operação.
    await Veiculo.updateOne({ _id: dados.veiculoId, clienteId: req.user.clienteId }, { $inc: { __v: 1 } }, { session });
    await Motorista.updateOne({ _id: dados.motoristaId, clienteId: req.user.clienteId }, { $inc: { __v: 1 } }, { session });
    const overlap = await Registro.findOne({ clienteId: req.user.clienteId, tipo: 'vinculos', ...(editar ? { _id: { $ne: req.params.id } } : {}), $and: [
      { $or: [{ 'dados.veiculoId': dados.veiculoId }, { 'dados.motoristaId': dados.motoristaId }] },
      { 'dados.inicio': { $lt: dados.fim || '9999-12-31T23:59:59.999Z' } },
      { $or: [{ 'dados.fim': { $exists: false } }, { 'dados.fim': { $gt: dados.inicio } }] },
    ] }).session(session);
    if (overlap) recusar('Já existe um vínculo desse veículo ou motorista no período. Encerre ou ajuste o vínculo anterior.', 409);
    if (editar) return Registro.findOneAndUpdate({ _id: req.params.id, clienteId: req.user.clienteId, tipo: 'vinculos' }, { $set: { dados } }, { new: true, session });
    return (await Registro.create([{ clienteId: req.user.clienteId, tipo: 'vinculos', dados, criadoPor: req.user.email }], { session }))[0];
  });
}
async function registrarPneu(clienteId, d, usuario) {
  await EstadoPneu.init();
  return mongoose.connection.transaction(async (session) => {
    let estado = await EstadoPneu.findOne({ clienteId, pneuId: d.pneuId }).session(session);
    if (!estado) estado = new EstadoPneu({ clienteId, pneuId: d.pneuId });
    if (estado.ultimaData && Date.parse(d.dataHora) <= estado.ultimaData.getTime()) recusar('Use uma data posterior à última movimentação desse pneu.');
    if (d.tipo === 'montagem' && estado.veiculoId) recusar('Pneu já montado. Registre a desmontagem primeiro.', 409);
    if (['desmontagem', 'rodizio'].includes(d.tipo) && (!estado.veiculoId || String(estado.veiculoId) !== d.veiculoId)) recusar('O pneu não está montado neste veículo.', 409);
    if (['desmontagem', 'rodizio'].includes(d.tipo)) {
      if (d.odometroKm < estado.odometroMontagem) recusar('Odômetro inferior ao da montagem.');
      estado.kmAcumulados += d.odometroKm - estado.odometroMontagem;
    }
    if (['montagem', 'rodizio'].includes(d.tipo)) { estado.veiculoId = d.veiculoId; estado.posicao = d.posicao; estado.odometroMontagem = d.odometroKm; }
    if (d.tipo === 'desmontagem') { estado.veiculoId = null; estado.posicao = undefined; estado.odometroMontagem = undefined; }
    if (d.tipo === 'recapagem') { if (estado.veiculoId) recusar('Desmonte o pneu antes de registrar recapagem.'); estado.recapagens++; }
    if (d.sulcoMm !== undefined) estado.sulcoMm = d.sulcoMm;
    if (d.tipo === 'inspecao' && d.sulcoMm === undefined) recusar('Informe a medida do sulco na inspeção.');
    estado.ultimaData = new Date(d.dataHora);
    const doc = (await Registro.create([{ clienteId, tipo: 'movimentacoes', dados: d, criadoPor: usuario }], { session }))[0];
    await estado.save({ session }); return doc;
  });
}
router.post('/:tipo', salvar(false));
router.put('/:tipo/:id', salvar(true));
module.exports = { router, sequenciar, registrarPneu };
