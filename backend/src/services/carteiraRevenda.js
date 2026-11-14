const Cliente = require('../models/Cliente');
const { limitarAcessos } = require('./acessosCliente');

async function escopoEmpresa(empresa) {
  if (!empresa || empresa.ativo === false) return null;
  if (!empresa.revendedoraId) return { acessos: empresa.acessos ?? null };
  const revendedora = await Cliente.findOne({
    _id: empresa.revendedoraId, tipo: 'revendedora', ativo: { $ne: false },
  }).select('acessos nome').lean();
  return revendedora && { revendedora, acessos: limitarAcessos(empresa.acessos, revendedora.acessos ?? {}) };
}

module.exports = { escopoEmpresa };
