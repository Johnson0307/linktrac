const mongoose = require('mongoose');
const Cliente = require('../models/Cliente');
const Veiculo = require('../models/Veiculo');
const { falha } = require('./cadastroFinanceiro');

const funcoes = {
  rastreamento: 'Rastreamento',
  telemetria: 'Telemetria',
  telemetria_completa: 'Telemetria completa',
  roteirizacao: 'Roteirização',
  videotelemetria: 'Videotelemetria',
};
const schema = new mongoose.Schema({
  _id: String,
  valores: { type: Map, of: Number, required: true },
  atualizadoPor: String,
}, { timestamps: true });
const Plano = mongoose.model('PlanoCobrancaCliente', schema);
const maxCentavos = 1000000;
const maxVeiculosSimulados = 10000;
const chave = (emissorId, clienteId) => `${emissorId}:${clienteId}`;
const calendario = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: 'numeric' });

function competenciaSeguinte(agora = new Date()) {
  const partes = calendario.formatToParts(agora);
  const ano = Number(partes.find(p => p.type === 'year').value);
  const mes = Number(partes.find(p => p.type === 'month').value);
  return new Date(Date.UTC(ano, mes, 1)).toISOString().slice(0, 7);
}

function validarPlano(valores) {
  if (!valores || typeof valores !== 'object' || Array.isArray(valores) || !Object.hasOwn(valores, 'rastreamento') ||
      Object.keys(valores).some(k => !Object.hasOwn(funcoes, k)) ||
      Object.values(valores).some(v => !Number.isSafeInteger(v) || v < 0 || v > maxCentavos)) {
    throw falha(400, 'Informe os preços por veículo em centavos, entre R$ 0,00 e R$ 10.000,00.');
  }
  if (Object.hasOwn(valores, 'telemetria') && Object.hasOwn(valores, 'telemetria_completa')) {
    throw falha(400, 'Selecione apenas uma modalidade de telemetria.');
  }
  return valores;
}

function calcular(valores, quantidade) {
  const itens = Object.entries(funcoes)
    .filter(([id]) => Object.hasOwn(valores, id))
    .map(([id, nome]) => ({
      id, nome, quantidade, valorUnitarioCentavos: valores[id], subtotalCentavos: quantidade * valores[id],
    }));
  return { quantidade, itens, totalCentavos: itens.reduce((total, item) => total + item.subtotalCentavos, 0) };
}

async function contarVeiculos(cliente) {
  if (cliente.ativo === false) return 0;
  const carteira = cliente.tipo === 'revendedora'
    ? await Cliente.find({ revendedoraId: cliente._id, ativo: { $ne: false } }).distinct('_id') : [];
  return Veiculo.countDocuments({
    clienteId: { $in: [cliente._id, ...carteira] }, ativo: { $ne: false },
    $nor: [{ marca: 'TESTE', modelo: 'SIMULACAO' }],
  });
}

async function obterPrevia(emissorId, cliente, simulacao) {
  const adicionais = simulacao?.adicionais ?? 0;
  if (!Number.isSafeInteger(adicionais) || adicionais < 0 || adicionais > maxVeiculosSimulados) {
    throw falha(400, 'Informe de 0 a 10.000 veículos adicionais na simulação.');
  }
  const [plano, quantidade] = await Promise.all([
    Plano.findById(chave(emissorId, cliente._id)).select('valores').lean(),
    contarVeiculos(cliente),
  ]);
  const valores = plano?.valores;
  return {
    competencia: competenciaSeguinte(), funcoes, valores: valores || null, quantidade,
    incluiCarteira: cliente.tipo === 'revendedora',
    previa: valores ? calcular(valores, quantidade) : null,
    simulacao: simulacao ? calcular(validarPlano(simulacao.valores), quantidade + adicionais) : null,
  };
}

async function salvarPlano(user, cliente, valores) {
  await Plano.updateOne({ _id: chave(user.clienteId, cliente._id) },
    { $set: { valores: validarPlano(valores), atualizadoPor: user.email || String(user.id) } }, { upsert: true });
}

module.exports = { calcular, competenciaSeguinte, obterPrevia, salvarPlano, validarPlano };
