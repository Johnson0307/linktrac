require('dotenv').config({ quiet: true });
const mongoose = require('mongoose');
const { copiarHistorico } = require('../src/services/copiarHistoricoArquivo');
const { fecharArquivo } = require('../src/services/historicoArquivo');

async function executar() {
  if (!process.env.MONGO_URI || !process.env.HISTORICO_ARQUIVO_URI || !process.env.HISTORICO_ARQUIVO_BANCO) {
    console.error('Configure o MongoDB principal e o banco de arquivo antes de executar.');
    process.exitCode = 1;
    return;
  }
  try {
    await mongoose.connect(process.env.MONGO_URI, { autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 5000, socketTimeoutMS: 45000 });
    console.table(await copiarHistorico());
  } catch {
    console.error('Cópia interrompida. Confira as conexões, as permissões e a consistência do arquivo. A execução pode ser repetida a partir do último lote verificado.');
    process.exitCode = 1;
  } finally {
    await Promise.all([fecharArquivo(), mongoose.disconnect()]);
  }
}

executar();
