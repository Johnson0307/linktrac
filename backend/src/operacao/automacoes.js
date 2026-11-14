const { Registro, Notificacao, Amostra, Dispositivo } = require('./modelos');
const { obterConfig } = require('./configuracao');
const { eventosTelemetria } = require('./telemetria');
const Motorista = require('../models/Motorista');
const Localizacao = require('../models/Localizacao');
const Manutencao = require('../models/Manutencao');
const { prepararEntregas, processarAvisosExternos, configuracaoDeEnvio } = require('./avisosExternos');
const { obterBase, eventosViarios } = require('./fiscalizacao');
const calendario = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' });
const identificar = async (veiculo, dataHora, telemetria) => {
  if (telemetria?.identificadorMotorista) {
    const motorista = await Motorista.findOne({ clienteId: veiculo.clienteId, identificador: telemetria.identificadorMotorista, status: 'ativo' }).select('_id').lean();
    return motorista?._id;
  }
  const horario = new Date(dataHora).toISOString();
  const vinculo = await Registro.findOne({ clienteId: veiculo.clienteId, tipo: 'vinculos', 'dados.veiculoId': String(veiculo._id), 'dados.inicio': { $lte: horario }, $or: [{ 'dados.fim': { $exists: false } }, { 'dados.fim': { $gt: horario } }] }).lean();
  if (!vinculo) return undefined;
  const motorista = await Motorista.findOne({ _id: vinculo.dados.motoristaId, clienteId: veiculo.clienteId, status: 'ativo' }).select('_id').lean();
  return motorista?._id;
};
const notificar = async (clienteId, chave, dados, veiculo, session) => {
  const config = veiculo ? await configuracaoDeEnvio(clienteId) : undefined;
  const entregasExternas = prepararEntregas(clienteId, dados, undefined, config, veiculo);
  await Notificacao.updateOne({ clienteId, chave }, { $setOnInsert: {
    ...dados, clienteId, chave, ...(entregasExternas ? { entregasExternas } : {}),
  } }, { upsert: true, ...(session ? { session } : {}) });
};
const processarPosicao = async (veiculo, posicao) => {
  const anterior = await Localizacao.findOne({ veiculoId: veiculo._id, _id: { $ne: posicao._id } }).sort({ dataHora: -1, _id: -1 }).lean();
  if (Date.now() - new Date(posicao.dataHora) > 5 * 60000 || (anterior && new Date(anterior.dataHora) >= new Date(posicao.dataHora))) return;
  const config = await obterConfig(veiculo.clienteId);
  const cercas = await Registro.find({ clienteId: veiculo.clienteId, tipo: 'cercas', 'dados.veiculoId': String(veiculo._id), 'dados.ativo': true }).lean();
  const eventos = eventosTelemetria(posicao, anterior, config, cercas.map((c) => ({ ...c.dados, id: String(c._id) })));
  for (const e of eventos) await notificar(veiculo.clienteId, `posicao:${posicao._id}:${e.tipo}`, { veiculoId: veiculo._id, motoristaId: posicao.motoristaId, tipo: e.tipo, mensagem: e.mensagem, simulado: posicao.fonte === 'simulado' });
  if (posicao.fonte !== 'simulado') {
    const base = await obterBase();
    const janela = Math.floor(Date.parse(posicao.dataHora) / 300000);
    for (const e of eventosViarios(base, posicao, anterior)) {
      await notificar(veiculo.clienteId, `${e.tipo}:${veiculo._id}:${e.id}:${janela}`, {
        veiculoId: veiculo._id, motoristaId: posicao.motoristaId, tipo: e.tipo, mensagem: e.mensagem,
      });
    }
  }
};
const avisarMultaRegistrada = multa => notificar(multa.clienteId, `multa:${multa._id}:cadastro`, {
  veiculoId: multa.dados.veiculoId, tipo: 'multa_registrada',
  mensagem: `Multa cadastrada para o veículo · Auto ${multa.dados.codigo} · ${multa.dados.orgao}.`,
});
const avaliarMultas = async (clienteId, agora = new Date()) => {
  const partes = Object.fromEntries(calendario.formatToParts(agora).map(p => [p.type, p.value]));
  const hoje = `${partes.year}-${partes.month}-${partes.day}`;
  const daquiSeteDias = new Date(Date.parse(hoje) + 7 * 86400000).toISOString().slice(0, 10);
  const pendentes = Registro.find({ tipo: 'multas', ...(clienteId ? { clienteId } : {}),
    'dados.status': { $in: ['pendente', 'em_recurso'] }, 'dados.prazo': { $lte: daquiSeteDias },
  }).select('clienteId dados').lean().cursor();
  for await (const multa of pendentes) {
    const { prazo, codigo, veiculoId } = multa.dados;
    const vencida = prazo < hoje;
    const tipo = vencida ? 'multa_vencida' : 'multa_prazo';
    await notificar(multa.clienteId, `${tipo}:${multa._id}:${prazo}`, { veiculoId, tipo,
      mensagem: `Auto ${codigo} · ${vencida ? 'Prazo vencido em' : 'Prazo até'} ${prazo.split('-').reverse().join('/')}.`,
    });
  }
};
const avaliarPlanos = async (clienteId) => {
  const planos = await Registro.find({ tipo: 'planos', 'dados.ativo': true, ...(clienteId ? { clienteId } : {}) }).limit(1000).lean();
  for (const plano of planos) {
    const d = plano.dados;
    const servico = await Manutencao.findOne({ clienteId: plano.clienteId, veiculoId: d.veiculoId, servico: d.servico }).sort({ dataServico: -1 }).lean();
    const ultimaData = servico && new Date(servico.dataServico) > new Date(d.ultimaData) ? new Date(servico.dataServico).toISOString().slice(0, 10) : d.ultimaData;
    const ultimoOdometro = servico && new Date(servico.dataServico) >= new Date(d.ultimaData) ? servico.quilometragem : d.ultimoOdometro;
    const [gps, amostra] = await Promise.all([Localizacao.findOne({ veiculoId: d.veiculoId, 'telemetria.odometroKm': { $exists: true } }).sort({ dataHora: -1 }).lean(), Amostra.findOne({ veiculoId: d.veiculoId, 'telemetria.odometroKm': { $exists: true } }).sort({ dataHora: -1 }).lean()]);
    const p = amostra && (!gps || new Date(amostra.dataHora) > new Date(gps.dataHora)) ? amostra : gps;
    const porData = d.intervaloDias && Date.now() >= Date.parse(ultimaData) + d.intervaloDias * 86400000;
    const porKm = d.intervaloKm && p?.telemetria?.odometroKm >= ultimoOdometro + d.intervaloKm;
    if (porData || porKm) await notificar(plano.clienteId, `plano:${plano._id}:${ultimaData}:${ultimoOdometro}:${d.intervaloKm || 0}:${d.intervaloDias || 0}`, { veiculoId: d.veiculoId, tipo: 'manutencao', mensagem: `Revisão pendente: ${d.servico}. Critério: ${[porData ? 'prazo' : '', porKm ? 'odômetro' : ''].filter(Boolean).join(' e ')}.`, simulado: p?.fonte === 'simulado' });
  }
};
const avaliarComunicacao = async () => {
  const dispositivos = await Dispositivo.find({ ativo: true }).limit(1000).lean();
  const configs = new Map();
  for (const d of dispositivos) {
    const key = String(d.clienteId);
    if (!configs.has(key)) configs.set(key, await obterConfig(d.clienteId));
    const desde = d.ultimaRecepcao || d.createdAt;
    if (desde && Date.now() - new Date(desde) > configs.get(key).ausenciaMinutos * 60000) {
      const v = await require('../models/Veiculo').findById(d.veiculoId).select('marca modelo').lean();
      await notificar(d.clienteId, `silencio:${d._id}:${new Date(desde).toISOString()}`, { veiculoId: d.veiculoId, tipo: 'comunicacao', mensagem: `Sem novas mensagens do equipamento ${d.nome} desde ${new Date(desde).toISOString()}.`, simulado: v?.marca === 'TESTE' && v?.modelo === 'SIMULACAO' });
    }
  }
};
let emExecucao = false;
const iniciarWorker = () => {
  const timer = setInterval(async () => {
    if (emExecucao) return; emExecucao = true;
    try { await avaliarPlanos(); await avaliarComunicacao(); await avaliarMultas(); await processarAvisosExternos(); }
    catch { console.error('Verificação operacional indisponível. Será tentada novamente.'); }
    finally { emExecucao = false; }
  }, 60000);
  timer.unref(); return timer;
};
module.exports = { identificar, processarPosicao, avaliarPlanos, avaliarComunicacao, avaliarMultas, avisarMultaRegistrada, iniciarWorker, notificar };
