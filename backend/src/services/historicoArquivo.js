const mongoose = require('mongoose');

const dia = 86400000;
const diasRecentes = 30;
const diasRetencao = 365;
let conexao;

async function abrirArquivo(origem = mongoose.connection) {
  const uri = process.env.HISTORICO_ARQUIVO_URI;
  const banco = process.env.HISTORICO_ARQUIVO_BANCO;
  if (!uri || !banco || !origem.name || banco === origem.name) {
    throw new Error('Configure um banco de arquivo com nome diferente do banco principal.');
  }
  if (!conexao) {
    const nova = mongoose.createConnection(uri, {
      dbName: banco, autoCreate: false, autoIndex: false, bufferCommands: false,
      serverSelectionTimeoutMS: 2200, socketTimeoutMS: 18000, maxPoolSize: 8,
    });
    nova.on('error', () => {});
    conexao = nova.asPromise().catch(async (erro) => {
      await nova.destroy().catch(() => {});
      conexao = undefined;
      throw erro;
    });
  }
  return conexao;
}

async function fecharArquivo() {
  if (!conexao) return;
  const banco = await conexao.catch(() => null);
  conexao = undefined;
  await banco?.destroy();
}

function erroArquivo(inicio, fim) {
  const iso = (d) => new Date(d).toISOString();
  const periodo = inicio ? `de ${iso(inicio)} até ${iso(fim)}` : `até ${iso(fim)}`;
  return Object.assign(new Error(`Arquivo de histórico indisponível. O período afetado é ${periodo}. Os últimos 30 dias continuam disponíveis.`),
    { status: 503, code: 'ARQUIVO_HISTORICO_INDISPONIVEL' });
}

// A autorização e os filtros do veículo são aplicados pelo ponto de entrada.
async function consultarHistorico(modelo, filtro, { limite, ordem = -1, campos, maxTimeMS } = {}) {
  const corte = new Date(Date.now() - diasRecentes * dia);
  const inicio = filtro.dataHora?.$gte ?? filtro.dataHora?.$gt;
  const fim = filtro.dataHora?.$lte ?? filtro.dataHora?.$lt;
  const cursor = filtro.$or?.find((criterio) => criterio.dataHora?.$lt)?.dataHora.$lt;
  const fimEfetivo = cursor && (!fim || +cursor < +fim) ? cursor : fim;
  const consultar = (fonte, criterios, tempo) => {
    let consulta = fonte.find(criterios);
    if (campos) consulta = consulta.select(campos);
    consulta = consulta.sort({ dataHora: ordem, _id: ordem }).limit(limite);
    if (tempo) consulta = consulta.maxTimeMS(tempo);
    return consulta.lean();
  };
  if (!process.env.HISTORICO_ARQUIVO_URI || (inicio && +inicio >= +corte)) {
    return consultar(modelo, filtro, maxTimeMS);
  }
  const consultarArquivo = async () => {
    try {
      const banco = await abrirArquivo(modelo.db);
      const arquivado = banco.models[modelo.modelName] ||
        banco.model(modelo.modelName, modelo.schema, modelo.collection.name);
      return await consultar(arquivado, { $and: [filtro, { dataHora: { $lt: corte } }] }, maxTimeMS || 12000);
    } catch {
      throw erroArquivo(inicio, fimEfetivo && +fimEfetivo < +corte ? fimEfetivo : corte);
    }
  };
  const recentes = await consultar(modelo, filtro, maxTimeMS);
  if (ordem === -1 && recentes.length === limite && +recentes.at(-1).dataHora >= +corte) return recentes;
  const antigos = await consultarArquivo();
  const unicos = new Map(antigos.map((item) => [String(item._id), item]));
  for (const item of recentes) unicos.set(String(item._id), item);
  return [...unicos.values()].sort((a, b) => {
    const idA = String(a._id);
    const idB = String(b._id);
    return ordem * (+a.dataHora - +b.dataHora || (idA > idB ? 1 : idA < idB ? -1 : 0));
  }).slice(0, limite);
}

module.exports = { abrirArquivo, fecharArquivo, consultarHistorico, dia, diasRecentes, diasRetencao };
