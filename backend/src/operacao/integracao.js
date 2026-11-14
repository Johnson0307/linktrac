const router = require('express').Router();
const crypto = require('node:crypto');
const { Dispositivo, Amostra, Gateway } = require('./modelos');
const Veiculo = require('../models/Veiculo');
const { id, horario } = require('./validacao');
const { atualizarPosicao } = require('../controllers/rastreamentoController');
const { receber: receberEventoVideo } = require('./videoEventos');
const { registrarSaude } = require('./saudeDispositivo');
const { registrarAlimentacao } = require('./alertaAlimentacao');
const limites = new Map();
router.use(async (req, res, next) => {
  try {
    let doc;
    if (['/traccar', '/video-eventos'].includes(req.path) && req.headers['x-gateway-id']) {
      const gid = req.headers['x-gateway-id']; const token = req.headers['x-gateway-token'];
      if (!id(gid) || typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) return res.status(401).json({ sucesso: false, mensagem: 'Credencial de gateway inválida.' });
      const gateway = await Gateway.findOne({ _id: gid, ativo: true }).select('+tokenHash');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      if (!gateway || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(gateway.tokenHash, 'hex'))) return res.status(401).json({ sucesso: false, mensagem: 'Credencial de gateway inválida.' });
      const codigo = req.body?.device?.uniqueId;
      if (typeof codigo !== 'string' || codigo.length > 100) return res.status(400).json({ sucesso: false, mensagem: 'Código externo do equipamento inválido.' });
      doc = await Dispositivo.findOne({ clienteId: gateway.clienteId, codigoExterno: codigo, ativo: true });
      if (!doc) return res.status(401).json({ sucesso: false, mensagem: 'Equipamento não autorizado no gateway desta empresa.' });
    } else {
      const dispositivoId = req.headers['x-device-id']; const token = req.headers['x-device-token'];
      if (!id(dispositivoId) || typeof token !== 'string' || !/^[a-f\d]{64}$/.test(token)) return res.status(401).json({ sucesso: false, mensagem: 'Credencial de equipamento inválida.' });
      doc = await Dispositivo.findOne({ _id: dispositivoId, ativo: true }).select('+tokenHash');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      if (!doc || !doc.tokenHash || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(doc.tokenHash, 'hex'))) return res.status(401).json({ sucesso: false, mensagem: 'Credencial de equipamento inválida.' });
    }
    const dispositivoId = String(doc._id);
    const agora = Date.now(); const limite = limites.get(dispositivoId);
    if (limite && agora - limite.inicio < 60000 && limite.total >= 120) return res.status(429).json({ sucesso: false, mensagem: 'Limite de 120 requisições por minuto por equipamento.' });
    if (!limite || agora - limite.inicio >= 60000) limites.set(dispositivoId, { inicio: agora, total: 1 }); else limite.total++;
    if (limites.size > 10000) limites.delete(limites.keys().next().value);
    const veiculo = await Veiculo.findOne({ _id: doc.veiculoId, clienteId: doc.clienteId });
    if (!veiculo) return res.status(404).json({ sucesso: false, mensagem: 'Veículo do equipamento não encontrado.' });
    req.dispositivo = doc; req.veiculoIntegracao = veiculo;
    next();
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Integração indisponível.' }); }
});
const registrarRecepcao = ({ dispositivo, veiculoIntegracao }, leitura, gps = false) => {
  if (veiculoIntegracao.marca === 'TESTE' && veiculoIntegracao.modelo === 'SIMULACAO') return undefined;
  return registrarSaude(dispositivo, leitura, gps).catch(() => {});
};
const verificarAlimentacao = (req, leitura, res) => registrarAlimentacao(req.dispositivo, req.veiculoIntegracao, leitura)
  .catch(() => { if (!res.headersSent) res.setHeader('X-Linktrac-Automacoes', 'indisponivel'); });
const preparar = (req, body) => ({ ...req, dispositivo: req.dispositivo, body: { ...body, placa: req.veiculoIntegracao.placa, veiculoId: String(req.veiculoIntegracao._id) } });
const valido = (body) => body && typeof body === 'object' && !Array.isArray(body) && horario(body.dataHora) && typeof body.mensagemId === 'string' && /^[\w.:-]{1,100}$/.test(body.mensagemId);
router.post('/posicoes', async (req, res) => {
  if (!valido(req.body)) return res.status(400).json({ sucesso: false, mensagem: 'Envie dataHora ISO com fuso e mensagemId único por posição.' });
  await atualizarPosicao(preparar(req, req.body), res);
  if (res.statusCode === 201) await verificarAlimentacao(req, { dataHora: req.body.dataHora, telemetria: req.body.telemetria }, res);
  if (res.statusCode < 300) await registrarRecepcao(req, res.statusCode === 201 ? req.body : undefined, true);
});
router.post('/lote', async (req, res) => {
  const items = req.body?.posicoes;
  if (!Array.isArray(items) || !items.length || items.length > 100 || items.some((p) => !valido(p))) return res.status(400).json({ sucesso: false, mensagem: 'Envie de 1 a 100 posições com dataHora e mensagemId.' });
  const resultados = [];
  let ultima;
  for (const p of [...items].sort((a, b) => Date.parse(a.dataHora) - Date.parse(b.dataHora))) {
    let status = 200; let body; const avisos = {};
    await atualizarPosicao(preparar(req, p), { status(code) { status = code; return this; }, json(b) { body = b; return this; }, setHeader(k, v) { avisos[k] = v; } });
    if (status === 201) {
      ultima = p;
      await verificarAlimentacao(req, { dataHora: p.dataHora, telemetria: p.telemetria }, res);
    }
    resultados.push({ mensagemId: p.mensagemId, status, sucesso: body?.sucesso === true, repetida: body?.repetida || false, mensagem: body?.mensagem, avisos });
  }
  if (resultados.some(r => r.sucesso)) await registrarRecepcao(req, ultima, true);
  return res.json({ sucesso: true, resultados, aceitas: resultados.filter((r) => r.sucesso).length });
});
router.post('/traccar', async (req, res) => {
  let body;
  try { body = require('./traccar').converterTraccar(req.body, req.dispositivo.codigoExterno, { aceitarAlarmeSemGps: true }); }
  catch (e) { return res.status(400).json({ sucesso: false, mensagem: e.message }); }
  if (body.semGPS) {
    await verificarAlimentacao(req, body, res);
    await registrarRecepcao(req, body);
    return res.json({ sucesso: true, semGPS: true });
  }
  await atualizarPosicao(preparar(req, body), res);
  if (res.statusCode === 201) await verificarAlimentacao(req, body, res);
  if (res.statusCode < 300) await registrarRecepcao(req, res.statusCode === 201 ? body : undefined, true);
});
router.post('/telemetria', async (req, res) => {
  if (!valido(req.body) || Date.parse(req.body.dataHora) > Date.now() + 300000 || Date.parse(req.body.dataHora) < Date.UTC(2000, 0, 1)) return res.status(400).json({ sucesso: false, mensagem: 'Envie horário válido e identificador da medição.' });
  const { dados, erros } = require('./telemetria').validarTelemetria(req.body.telemetria);
  if (erros.length || !dados || !Object.keys(dados).length || (req.body.ignicao != null && typeof req.body.ignicao !== 'boolean') || (req.body.velocidade !== undefined && (!Number.isFinite(req.body.velocidade) || req.body.velocidade < 0 || req.body.velocidade > 300))) return res.status(400).json({ sucesso: false, mensagem: erros.join(' ') || 'Telemetria, ignição ou velocidade inválida.' });
  try {
    await Amostra.init();
    const filtro = { veiculoId: req.veiculoIntegracao._id, mensagemId: req.body.mensagemId };
    const existente = await Amostra.findOne(filtro);
    if (existente) {
      await verificarAlimentacao(req, existente, res);
      return res.json({ sucesso: true, repetida: true });
    }
    const motoristaId = await require('./automacoes').identificar(req.veiculoIntegracao, req.body.dataHora, dados);
    let p;
    try { p = await Amostra.create({ ...filtro, clienteId: req.dispositivo.clienteId, motoristaId, dataHora: new Date(req.body.dataHora), fonte: req.veiculoIntegracao.marca === 'TESTE' && req.veiculoIntegracao.modelo === 'SIMULACAO' ? 'simulado' : 'dispositivo', ignicao: req.body.ignicao ?? null, velocidade: req.body.velocidade, telemetria: dados }); }
    catch (e) { if (e.code === 11000) return res.json({ sucesso: true, repetida: true }); throw e; }
    try {
      const anterior = await Amostra.findOne({ veiculoId: p.veiculoId, _id: { $ne: p._id } }).sort({ dataHora: -1 }).lean();
      if (Date.now() - new Date(p.dataHora) <= 300000 && (!anterior || new Date(anterior.dataHora) < new Date(p.dataHora))) {
        const config = await require('./configuracao').obterConfig(req.dispositivo.clienteId);
        const eventos = require('./telemetria').eventosTelemetria(p.toObject(), anterior, config);
        for (const e of eventos) await require('./automacoes').notificar(req.dispositivo.clienteId, `amostra:${p._id}:${e.tipo}`, { veiculoId: p.veiculoId, motoristaId, tipo: e.tipo, mensagem: e.mensagem, simulado: p.fonte === 'simulado' });
      }
    } catch { res.setHeader('X-Linktrac-Automacoes', 'indisponivel'); }
    await verificarAlimentacao(req, p, res);
    await registrarRecepcao(req, p);
    return res.status(201).json({ sucesso: true, semGPS: true, dados: { id: p._id, dataHora: p.dataHora } });
  } catch { return res.status(503).json({ sucesso: false, mensagem: 'Telemetria indisponível.' }); }
});
router.post('/video-eventos', async (req, res) => {
  await receberEventoVideo(req, res);
  if (res.statusCode < 300) await registrarRecepcao(req);
});
module.exports = router;
