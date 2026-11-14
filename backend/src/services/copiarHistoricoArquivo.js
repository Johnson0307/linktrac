const { createHash, randomUUID } = require('node:crypto');
const mongoose = require('mongoose');
const Localizacao = require('../models/Localizacao');
const { Amostra } = require('../operacao/modelos');
const { abrirArquivo, dia, diasRecentes, diasRetencao } = require('./historicoArquivo');

const fontes = [Localizacao, Amostra];
const fluxos = ['dataHora', 'recebidoEm'];
const atrasoDeSeguranca = 5 * 60000;
const opcoesDeLeitura = { promoteValues: false, maxTimeMS: 12000 };
const destinoId = () => createHash('sha256')
  .update(process.env.HISTORICO_ARQUIVO_URI || '').update('\0')
  .update(process.env.HISTORICO_ARQUIVO_BANCO || '').digest('hex');
const chave = (modelo, campo) => `${destinoId()}:${modelo.modelName}:${campo}`;
const controle = (banco) => banco.collection('historico_arquivo_progresso');
const inicioRetencao = (agora) => new Date(+agora - diasRetencao * dia);
const corteRecente = (agora) => new Date(+agora - diasRecentes * dia);

function canonico(valor) {
  if (Array.isArray(valor)) return valor.map(canonico);
  if (!valor || Object.getPrototypeOf(valor) !== Object.prototype) return valor;
  return Object.fromEntries(Object.keys(valor).sort().map((chave) => [chave, canonico(valor[chave])]));
}

async function copiarLote(destino, leituras) {
  await destino.bulkWrite(leituras.map(({ _id, ...dados }) => ({
    updateOne: { filter: { _id }, update: { $setOnInsert: dados }, upsert: true },
  })), { ordered: false, writeConcern: { w: 'majority', j: true } });
  const copias = await destino.find({ _id: { $in: leituras.map((r) => r._id) } }, opcoesDeLeitura).toArray();
  const serializar = (r) => mongoose.mongo.BSON.EJSON.stringify(canonico(r), { relaxed: false });
  const porId = new Map(copias.map((r) => [String(r._id), serializar(r)]));
  if (leituras.some((r) => porId.get(String(r._id)) !== serializar(r))) {
    throw new Error('O conteúdo copiado diverge da leitura original.');
  }
}

function abrirJanela(campo, estado, agora, primeiraExecucao) {
  if (estado.janela) return estado.janela;
  const porMedicao = campo === 'dataHora';
  const limite = new Date(+agora - atrasoDeSeguranca);
  return {
    inicio: new Date(Math.max(+(estado.concluidoAte || (porMedicao ? inicioRetencao(agora) : primeiraExecucao)), +inicioRetencao(agora))),
    fim: porMedicao ? corteRecente(agora) : limite,
    medicaoInicio: inicioRetencao(agora),
    // Pontos recentes no recebimento serão cobertos pelo fluxo de data da medição.
    medicaoFim: corteRecente(agora),
  };
}

async function copiarFluxo({ modelo, campo, origem, arquivo, agora, primeiraExecucao, tamanho, lotes }) {
  const registros = controle(origem);
  const _id = chave(modelo, campo);
  const dono = randomUUID();
  await registros.updateOne({ _id }, { $setOnInsert: { modelo: modelo.modelName, campo } }, { upsert: true });
  const trava = { _id, dono };
  const limiteTrava = () => new Date(Date.now() + 120000);
  const estado = await registros.findOneAndUpdate({ _id, $or: [
    { travaAte: { $exists: false } }, { travaAte: { $lte: new Date() } },
  ] }, { $set: { dono, travaAte: limiteTrava() } }, { returnDocument: 'after' });
  if (!estado) return { ocupado: true };
  const origemDados = origem.collection(modelo.collection.name);
  const destino = arquivo.collection(modelo.collection.name);
  const salvar = async (atualizacao) => {
    const r = await registros.updateOne({ ...trava, travaAte: { $gt: new Date() } }, atualizacao);
    if (!r.matchedCount) throw new Error('A reserva do lote expirou.');
  };
  try {
    const janela = abrirJanela(campo, estado, agora, primeiraExecucao);
    if (+janela.inicio >= +janela.fim) return { pendente: false, verificadas: 0 };
    let cursor = estado.cursor;
    let verificadas = 0;
    for (let i = 0; i < lotes; i++) {
      const filtro = { [campo]: { $gte: janela.inicio, $lt: janela.fim } };
      if (campo === 'recebidoEm') filtro.dataHora = { $gte: janela.medicaoInicio, $lt: janela.medicaoFim };
      if (cursor) filtro.$or = [{ [campo]: { $gt: cursor.data } }, { [campo]: cursor.data, _id: { $gt: cursor.id } }];
      const leituras = await origemDados.find(filtro, opcoesDeLeitura).sort({ [campo]: 1, _id: 1 }).limit(tamanho).toArray();
      if (leituras.length) await copiarLote(destino, leituras);
      verificadas += leituras.length;
      const fimDoFluxo = leituras.length < tamanho;
      const ultima = leituras.at(-1);
      const progresso = { ultimaVerificacao: new Date(), travaAte: limiteTrava() };
      if (fimDoFluxo) {
        await salvar({ $set: { ...progresso, concluidoAte: janela.fim }, $unset: { janela: '', cursor: '' } });
        return { pendente: false, verificadas };
      }
      cursor = { data: ultima[campo], id: ultima._id };
      await salvar({ $set: { ...progresso, janela, cursor } });
    }
    return { pendente: true, verificadas };
  } finally {
    await registros.updateOne(trava, { $unset: { dono: '', travaAte: '' } });
  }
}

async function copiarHistorico({ origem = mongoose.connection, agora = new Date(), tamanho = 500, lotes = 10 } = {}) {
  const arquivo = await abrirArquivo(origem);
  const registros = controle(origem);
  const execucao = await registros.findOneAndUpdate({ _id: `${destinoId()}:inicio` }, {
    $setOnInsert: { inicio: new Date(+agora - atrasoDeSeguranca) },
  }, { upsert: true, returnDocument: 'after' });
  const resultados = [];
  for (const modelo of fontes) {
    const chaveLeitura = { veiculoId: 1, dataHora: -1, _id: -1 };
    for (const campo of fluxos) {
      await origem.collection(modelo.collection.name).createIndex({ [campo]: 1, _id: 1 });
    }
    await arquivo.collection(modelo.collection.name).createIndex(chaveLeitura);
    await arquivo.collection(modelo.collection.name).createIndex({ dataHora: 1, _id: 1 });
    for (const campo of fluxos) {
      resultados.push({ fonte: modelo.modelName, campo, ...await copiarFluxo({
        modelo, campo, origem, arquivo, agora, primeiraExecucao: execucao.inicio, tamanho, lotes,
      }) });
    }
  }
  return resultados;
}

async function saudeArquivo(origem = mongoose.connection, agora = new Date()) {
  const base = { diasRecentes, diasRetencao, modo: 'copia' };
  if (!process.env.HISTORICO_ARQUIVO_URI) return { ...base, estado: 'desativado', fontes: [] };
  const registros = controle(origem);
  const banco = await abrirArquivo(origem).then(async (arquivo) => {
    await arquivo.db.command({ ping: 1 }, { timeoutMS: 3000 });
    return arquivo;
  }).catch(() => null);
  const dados = await Promise.all(fontes.map(async (modelo) => {
    const [medicao, atrasos] = await Promise.all(fluxos.map(campo => registros.findOne({ _id: chave(modelo, campo) })));
    const maisAntigo = await banco?.collection(modelo.collection.name).findOne({}, {
      sort: { dataHora: 1, _id: 1 }, projection: { dataHora: 1 }, maxTimeMS: 2500, timeoutMS: 3500,
    });
    return {
      fonte: modelo.modelName, maisAntigo: maisAntigo?.dataHora ?? null,
      ultimaVerificacao: [medicao?.ultimaVerificacao, atrasos?.ultimaVerificacao].filter(Boolean).sort((a, b) => b - a)[0] ?? null,
      verificadoAte: medicao?.concluidoAte ?? null, recebimentoVerificadoAte: atrasos?.concluidoAte ?? null,
      pendenteDesde: medicao?.janela ? medicao.cursor?.data || medicao.janela.inicio : medicao?.concluidoAte || inicioRetencao(agora),
      sincronizando: Boolean(medicao?.travaAte > agora || atrasos?.travaAte > agora),
    };
  }));
  return { ...base, estado: banco ? 'disponivel' : 'indisponivel', fontes: dados };
}

module.exports = { copiarHistorico, saudeArquivo };
