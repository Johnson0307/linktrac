const router = require('express').Router();
const { authenticate } = require('../middlewares/authMiddleware');
const { authorize } = require('../middlewares/authorizationMiddleware');
const Veiculo = require('../models/Veiculo');
const Localizacao = require('../models/Localizacao');
const Motorista = require('../models/Motorista');
const { Registro, Notificacao, Amostra } = require('./modelos');
const { id, horario } = require('./validacao');
const { gerarResumoSemanal } = require('./resumoSemanal');
const { metrosEntre } = require('./telemetria');
const { consultarTrajeto, gerarKml } = require('./trajetoRelatorio');
const { consultarHistorico } = require('../services/historicoArquivo');
const campos = [
  ['dataHora', 'Horário da medição'], ['tipoRegistro', 'Tipo do registro'], ['recebidoEm', 'Horário do recebimento'], ['latitude', 'Latitude'], ['longitude', 'Longitude'],
  ['velocidade', 'Velocidade (km/h)'], ['ignicao', 'Ignição'], ['fonte', 'Origem'], ['motoristaId', 'Identificador do motorista'],
  ['telemetria.odometroKm', 'Odômetro (km)'], ['telemetria.rpm', 'RPM'], ['telemetria.combustivelPct', 'Combustível (%)'],
  ['telemetria.combustivelLitros', 'Combustível (litros)'], ['telemetria.temperaturaMotor', 'Temperatura do motor (°C)'],
  ['telemetria.temperaturaCarga', 'Temperatura da carga (°C)'], ['telemetria.tensaoBateria', 'Bateria (V)'],
  ['telemetria.horimetroHoras', 'Horímetro (h)'], ['telemetria.bateriaEquipamentoPct', 'Bateria do equipamento (%)'],
  ['telemetria.alimentacaoExterna', 'Alimentação externa'], ['telemetria.rodas', 'Pressão e temperatura por roda'],
  ['telemetria.portaAberta', 'Porta aberta'], ['telemetria.passageiroPresente', 'Passageiro presente'], ['telemetria.dtcs', 'Códigos DTC'],
  ['telemetria.eventosCamera', 'Eventos da câmera'], ['telemetria.aceleracaoMss', 'Aceleração (m/s²)'], ['telemetria.curvaMss', 'Aceleração lateral (m/s²)'], ['telemetria.rede', 'Rede informada'],
].map(([key, label]) => ({ key, label }));
const extrair = (obj, key) => key.split('.').reduce((a, k) => a?.[k], obj) ?? null;
const consultar = async (clienteId, body) => {
  const { veiculoId, inicio, fim, colunas } = body || {};
  if (!id(veiculoId) || !horario(inicio) || !horario(fim) || Date.parse(inicio) > Date.parse(fim) || Date.parse(fim) - Date.parse(inicio) > 366 * 86400000 || !Array.isArray(colunas) || !colunas.length || colunas.length > campos.length || colunas.some((k) => !campos.some((c) => c.key === k)))
    throw Object.assign(new Error('Selecione veículo, período de até 366 dias e campos válidos.'), { status: 400 });
  if (!(await Veiculo.exists({ _id: veiculoId, clienteId }))) throw Object.assign(new Error('Veículo da empresa não encontrado.'), { status: 404 });
  const selecionadas = [...new Set(colunas)];
  const filtro = { veiculoId, dataHora: { $gte: new Date(inicio), $lte: new Date(fim) } };
  const [gps, amostras] = await Promise.all([
    consultarHistorico(Localizacao, filtro, { limite: 2001 }),
    body.incluirSemGPS === true ? consultarHistorico(Amostra, { ...filtro, clienteId }, { limite: 2001 }) : [],
  ]);
  const registros = [...gps.map((p) => ({ ...p, tipoRegistro: 'posição' })), ...amostras.map((p) => ({ ...p, tipoRegistro: 'telemetria sem GPS' }))].sort((a, b) => new Date(b.dataHora) - new Date(a.dataHora));
  const dados = registros.slice(0, 2000).reverse().map((p) => Object.fromEntries(selecionadas.map((key) => [key, extrair(p, key)])));
  return { dados, colunas: selecionadas.map((key) => campos.find((c) => c.key === key)), limitado: registros.length > 2000, quantidade: dados.length };
};
const celulaCSV = (value) => {
  let texto = value === null || value === undefined ? '' : Array.isArray(value) ? value.map(item => item && typeof item === 'object' ? JSON.stringify(item) : item).join(' | ') : value instanceof Date ? value.toISOString() : String(value);
  if (/^[\s]*[=+\-@]/.test(texto) || /^[\t\r]/.test(texto)) texto = `'${texto}`;
  return `"${texto.replace(/"/g, '""')}"`;
};
const csv = (resultado) => '\uFEFF' + [resultado.colunas.map((c) => celulaCSV(c.label)).join(';'), ...resultado.dados.map((row) => resultado.colunas.map((c) => celulaCSV(row[c.key])).join(';'))].join('\r\n');
router.use(authenticate, authorize('admin', 'gestor'));
router.post('/trajeto', async (req, res) => {
  try {
    const { resumo } = await consultarTrajeto(req.user.clienteId, req.body);
    return res.set('Cache-Control', 'private, no-store').json({ sucesso: true, dados: resumo });
  } catch (e) {
    return res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Relatório de trajeto indisponível.' });
  }
});
router.post('/trajeto/kml', async (req, res) => {
  try {
    const resultado = await consultarTrajeto(req.user.clienteId, req.body);
    const kml = gerarKml(resultado);
    const placa = resultado.resumo.placa.replace(/[^A-Za-z0-9-]/g, '');
    return res.set('Cache-Control', 'private, no-store')
      .attachment(`linktrac-trajeto-${placa || 'veiculo'}.kml`).type('application/vnd.google-earth.kml+xml').send(kml);
  } catch (e) {
    return res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Exportação KML indisponível.' });
  }
});
router.get('/resumo-semanal', async (req, res) => {
  try {
    res.set('Cache-Control', 'no-store');
    return res.json({ sucesso: true, dados: await gerarResumoSemanal(req.user.clienteId) });
  } catch {
    return res.status(503).json({ sucesso: false, mensagem: 'Resumo semanal indisponível.' });
  }
});
router.get('/campos', (req, res) => res.json({ sucesso: true, dados: campos }));
router.post('/consultar', async (req, res) => {
  try { res.json({ sucesso: true, ...await consultar(req.user.clienteId, req.body) }); }
  catch (e) { res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Relatório indisponível.' }); }
});
router.post('/csv', async (req, res) => {
  try { const resultado = await consultar(req.user.clienteId, req.body); res.setHeader('X-Linktrac-Limitado', String(resultado.limitado)); res.type('text/csv; charset=utf-8').attachment('linktrac-telemetria.csv').send(csv(resultado)); }
  catch (e) { res.status(e.status || 503).json({ sucesso: false, mensagem: e.status ? e.message : 'Exportação indisponível.' }); }
});
router.get('/comportamento', async (req, res) => {
  try {
    const docs = await Notificacao.find({ clienteId: req.user.clienteId, tipo: { $in: ['frenagem', 'aceleracao', 'curva'] } }).sort({ createdAt: -1 }).limit(2001).lean();
    const eventos = docs.slice(0, 2000); const resumo = new Map();
    const ids = eventos.filter((e) => !e.motoristaId && e.chave?.startsWith('posicao:')).map((e) => e.chave.split(':')[1]).filter(id);
    const posicoes = ids.length ? await consultarHistorico(Localizacao, { _id: { $in: ids } }, { campos: '_id motoristaId dataHora', limite: ids.length }) : [];
    const motoristasPorPosicao = new Map(posicoes.map((p) => [String(p._id), p.motoristaId]));
    for (const e of eventos) {
      const motorista = e.motoristaId || motoristasPorPosicao.get(e.chave?.split(':')[1]); if (!motorista) continue;
      const key = String(motorista); const item = resumo.get(key) || { motoristaId: key, eventos: 0, frenagens: 0, aceleracoes: 0, curvas: 0 };
      item.eventos++; item[e.tipo === 'frenagem' ? 'frenagens' : e.tipo === 'curva' ? 'curvas' : 'aceleracoes']++; resumo.set(key, item);
    }
    const dados = [];
    const motoristas = await Motorista.find({ _id: { $in: [...resumo.keys()] }, clienteId: req.user.clienteId }).select('_id nome').lean();
    for (const item of resumo.values()) {
      const m = motoristas.find((m) => String(m._id) === item.motoristaId);
      if (m) dados.push({ ...item, nome: m.nome, notaIndicativa: Math.max(0, 100 - item.eventos * 5) });
    }
    dados.sort((a, b) => b.notaIndicativa - a.notaIndicativa);
    res.json({ sucesso: true, dados, limitado: docs.length > 2000, criterio: 'Nota indicativa: 100 menos 5 por evento nas últimas 2.000 notificações técnicas de comportamento. Sem ajuste por distância ou exposição; não é comparação de desempenho nem avaliação profissional.' });
  } catch (e) { res.status(503).json({ sucesso: false, mensagem: e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL' ? e.message : 'Comportamento indisponível.' }); }
});
router.get('/combustivel', async (req, res) => {
  try {
    const registros = await Registro.find({ clienteId: req.user.clienteId, tipo: 'abastecimentos' }).sort({ 'dados.dataHora': -1 }).limit(101).lean();
    const ids = registros.slice(0, 100).map(r => r.dados.veiculoId).filter(id);
    const veiculos = await Veiculo.find({ clienteId: req.user.clienteId, _id: { $in: ids } }).distinct('_id');
    const veiculosDaEmpresa = new Set(veiculos.map(String));
    const dados = [];
    for (const registro of registros.slice(0, 100)) {
      const d = registro.dados; const t = Date.parse(d.dataHora); const avisos = [];
      const filtro = { veiculoId: d.veiculoId, fonte: { $ne: 'simulado' }, status: { $ne: 'Sem sinal' } };
      const pontos = veiculosDaEmpresa.has(String(d.veiculoId)) && Number.isFinite(t) ? (await Promise.all([
        consultarHistorico(Localizacao, { ...filtro, dataHora: { $gte: new Date(t - 900000), $lte: new Date(t) } }, { limite: 1 }),
        consultarHistorico(Localizacao, { ...filtro, dataHora: { $gt: new Date(t), $lte: new Date(t + 900000) } }, { limite: 1, ordem: 1 }),
      ])).flat() : [];
      pontos.sort((a, b) => Math.abs(new Date(a.dataHora) - t) - Math.abs(new Date(b.dataHora) - t));
      const p = pontos[0];
      if (p && Math.abs(new Date(p.dataHora) - t) <= 180000 && p.ignicao === true && p.velocidade > 5) {
        avisos.push('Ignição ligada e deslocamento em leitura a até 3 minutos do abastecimento. Confira os horários.');
      }
      if (!p) avisos.push('Sem posição em até 15 minutos do abastecimento.');
      if (p && d.latitude !== undefined && metrosEntre(p, d) > 2000) avisos.push('Local informado a mais de 2 km da posição próxima.');
      if (p?.telemetria?.odometroKm !== undefined && Math.abs(p.telemetria.odometroKm - d.odometroKm) > 5) avisos.push('Odômetro informado diverge mais de 5 km da leitura próxima.');
      if (d.comprovante && await Registro.countDocuments({ clienteId: req.user.clienteId, tipo: 'abastecimentos', 'dados.comprovante': d.comprovante }) > 1) avisos.push('Referência de comprovante repetida.');
      dados.push({ id: registro._id, ...d, avisos, conferido: avisos.length === 0, posicaoProxima: Boolean(p) });
    }
    res.json({ sucesso: true, dados, limitado: registros.length > 100, criterio: 'Triagem das últimas 100 entradas. Divergências são indícios, não prova de fraude. Sem leitura de cupom fiscal ou validação tributária automática.' });
  } catch (e) { res.status(503).json({ sucesso: false, mensagem: e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL' ? e.message : 'Conferência de combustível indisponível.' }); }
});
router.get('/financeiro', async (req, res) => {
  try {
    const { inicio, fim, veiculoId } = req.query;
    if (!horario(inicio) || !horario(fim) || Date.parse(inicio) > Date.parse(fim) || Date.parse(fim) - Date.parse(inicio) > 366 * 86400000 || (veiculoId && !id(veiculoId))) return res.status(400).json({ sucesso: false, mensagem: 'Informe período válido de até 366 dias.' });
    const veiculos = await Veiculo.find({ clienteId: req.user.clienteId, $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }], ...(veiculoId ? { _id: veiculoId } : {}) }).select('_id').lean();
    const ids = veiculos.map((v) => v._id); const strings = ids.map(String);
    const [abastecimentos, servicos, gps, amostras] = ids.length ? await Promise.all([
      Registro.find({ clienteId: req.user.clienteId, tipo: 'abastecimentos', 'dados.veiculoId': { $in: strings }, 'dados.dataHora': { $gte: new Date(inicio).toISOString(), $lte: new Date(fim).toISOString() } }).sort({ 'dados.dataHora': -1 }).limit(2001).lean(),
      require('../models/Manutencao').find({ clienteId: req.user.clienteId, veiculoId: { $in: ids }, dataServico: { $gte: new Date(inicio), $lte: new Date(fim) } }).sort({ dataServico: -1 }).limit(2001).lean(),
      consultarHistorico(Localizacao, { veiculoId: { $in: ids }, fonte: { $ne: 'simulado' }, dataHora: { $gte: new Date(inicio), $lte: new Date(fim) }, 'telemetria.odometroKm': { $exists: true } }, { limite: 2001 }),
      consultarHistorico(Amostra, { clienteId: req.user.clienteId, veiculoId: { $in: ids }, fonte: { $ne: 'simulado' }, dataHora: { $gte: new Date(inicio), $lte: new Date(fim) }, 'telemetria.odometroKm': { $exists: true } }, { limite: 2001 }),
    ]) : [[], [], [], []];
    const resumo = require('./financeiro').resumirFinanceiro(abastecimentos.slice(0, 2000), servicos.slice(0, 2000), [...gps.slice(0, 2000), ...amostras.slice(0, 2000)]);
    res.json({ sucesso: true, dados: resumo, limitado: [abastecimentos, servicos, gps, amostras].some((a) => a.length > 2000), veiculos: ids.length,
      criterio: 'Somente veículos reais próprios. Custos registrados no período; distância pelo intervalo observado de odômetro, sem regressões. Custo/km indicativo, sem salários, impostos ou depreciação; não substitui contabilidade.' });
  } catch (e) { res.status(503).json({ sucesso: false, mensagem: e.code === 'ARQUIVO_HISTORICO_INDISPONIVEL' ? e.message : 'Resumo financeiro indisponível.' }); }
});
module.exports = { router, consultar, campos, csv, celulaCSV };
