// Simulação finita, restrita ao veículo TESTE01 da empresa Linktrac.
const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env'), quiet: true });
require('node:dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');
const Cliente = require('../src/models/Cliente');
const Veiculo = require('../src/models/Veiculo');
const { atualizarPosicao, consultarUltimaPosicao } = require('../src/controllers/rastreamentoController');

const executar = async (controller, req) => {
  let status = 200;
  let body;
  await controller(req, {
    status(code) { status = code; return this; },
    json(value) { body = value; return this; },
  });
  if (status >= 400 || !body?.sucesso) throw new Error(`Operação recusada (${status}).`);
  return body;
};

async function main() {
  if (!process.env.MONGO_URI || !mongoose.isObjectIdOrHexString(process.env.LINKTRAC_CLIENT_ID))
    throw new Error('Configure o banco e a empresa Linktrac antes da simulação.');
  try {
    await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: false, autoCreate: false, serverSelectionTimeoutMS: 10000,
    });
    const clienteId = process.env.LINKTRAC_CLIENT_ID;
    const empresa = await Cliente.findOne({ _id: clienteId, slug: 'linktrac', ativo: { $ne: false } });
    if (!empresa) throw new Error('Empresa Linktrac ativa não encontrada.');
    const filtro = { clienteId, placa: 'TESTE01' };
    let veiculo = await Veiculo.findOne(filtro);
    if (veiculo && (veiculo.marca !== 'TESTE' || veiculo.modelo !== 'SIMULACAO'))
      throw new Error('TESTE01 já está em uso por outro veículo. Nada foi alterado.');
    if (!veiculo) veiculo = await Veiculo.create({
      ...filtro, marca: 'TESTE', modelo: 'SIMULACAO', ano: 2026,
      nomeCliente: 'Linktrac — dados simulados', ativo: true,
    });
    console.log('Veículo TESTE01: posições fictícias em Brasília. Nenhum rastreador real será acionado.');
    const velocidades = [0, 12, 24, 90, 28, 20, 12, 0];
    for (let i = 0; i < velocidades.length; i++) {
      await executar(atualizarPosicao, { body: {
        placa: veiculo.placa, veiculoId: String(veiculo._id),
        latitude: -15.7942 + i * 0.0002, longitude: -47.8822 + i * 0.00025,
        velocidade: velocidades[i], endereco: `SIMULAÇÃO — trecho ${i + 1} de ${velocidades.length}, Brasília`,
        ignicao: i > 0 && i < velocidades.length - 1,
      } });
      const leitura = await executar(consultarUltimaPosicao, {
        user: { clienteId }, params: { placa: veiculo.placa }, query: { veiculoId: String(veiculo._id) },
      });
      if (leitura.localizacao.velocidade !== velocidades[i])
        throw new Error('A posição consultada diverge da simulação.');
      console.log(`Posição ${i + 1}/${velocidades.length} gravada e consultada: ${velocidades[i]} km/h, ${leitura.localizacao.status}.`);
      if (i < velocidades.length - 1) await new Promise((resolve) => setTimeout(resolve, 3000));
    }
    console.log('Simulação concluída. Consulte TESTE01 em Rastreamento. Os dados de teste foram mantidos.');
  } finally { await mongoose.disconnect(); }
}
main().catch((error) => {
  // Não expõe URLs de conexão, documentos nem credenciais.
  if (error.code === 8000 || error.code === 18) {
    console.error('MongoDB recusou a autenticação. Confira o usuário e a senha do banco em MONGO_URI no backend/.env. A senha de login no Linktrac é independente.');
    process.exitCode = 1;
    return;
  }
  console.error(error.name === 'Error' ? error.message : `Falha na simulação (${error.name}; código ${error.code || 'não informado'}). Verifique a conexão e a configuração.`);
  process.exitCode = 1;
});
