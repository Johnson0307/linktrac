const { Dispositivo } = require('./modelos');
const { notificar } = require('./automacoes');
const { tipoAlertaAlimentacao, horarioAlerta } = require('./avisosExternos');

async function registrarAlimentacao(dispositivo, veiculo, leitura, agora = new Date()) {
  const alimentada = leitura?.telemetria?.alimentacaoExterna;
  if (typeof alimentada !== 'boolean' || leitura.fonte === 'simulado' ||
      (veiculo.marca === 'TESTE' && veiculo.modelo === 'SIMULACAO') || veiculo.ativo === false) return;
  const dataHora = new Date(leitura.dataHoraAlimentacao || leitura.dataHora);
  if (!leitura.dataHora || !Number.isFinite(+dataHora) || Math.abs(agora - dataHora) > 300000) return;
  await Dispositivo.db.transaction(async session => {
    const anterior = await Dispositivo.findOneAndUpdate({
      _id: dispositivo._id, clienteId: veiculo.clienteId, veiculoId: veiculo._id,
      codigoExterno: dispositivo.codigoExterno || { $in: [null, ''] }, ativo: true,
      $or: [{ 'estadoAlimentacao.dataHora': { $exists: false } }, { 'estadoAlimentacao.dataHora': { $lt: dataHora } }],
    }, { $set: { estadoAlimentacao: { alimentada, dataHora } } },
    { returnDocument: 'before', timestamps: false, session }).select('+estadoAlimentacao').lean();
    if (!anterior || alimentada || (anterior.estadoAlimentacao?.alimentada !== true && !(leitura.corteAlimentacao && !anterior.estadoAlimentacao))) return;
    const mensagem = `Alerta Linktrac: o veículo ${veiculo.placa} perdeu a alimentação do rastreador em ${horarioAlerta.format(dataHora)}. Verifique a bateria e a instalação.`;
    await notificar(veiculo.clienteId, `alimentacao:${dispositivo._id}:${dataHora.toISOString()}`, {
      tipo: tipoAlertaAlimentacao, veiculoId: veiculo._id, mensagem, ocorridoEm: dataHora,
    }, veiculo, session);
  });
}

module.exports = { registrarAlimentacao };
