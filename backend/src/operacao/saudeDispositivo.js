const { Dispositivo } = require('./modelos');

function registrarSaude(dispositivo, leitura, gps, agora = new Date()) {
  const anterior = '$ultimaRecepcao';
  const campos = {
    ultimaRecepcao: { $max: [anterior, agora] },
    lacunasRecepcao: { $cond: [
      { $and: [{ $eq: [{ $type: anterior }, 'date'] }, { $gt: [{ $subtract: [agora, anterior] }, 300000] }] },
      { $slice: [{ $concatArrays: [{ $ifNull: ['$lacunasRecepcao', []] },
        [{ ultimaRecepcao: anterior, retomadaEm: agora }]] }, -10] },
      '$lacunasRecepcao',
    ] },
  };
  if (leitura) {
    const dataHora = new Date(leitura.dataHora);
    const resumo = { dataHora };
    if (typeof leitura.ignicao === 'boolean') resumo.ignicao = leitura.ignicao;
    if (typeof leitura.telemetria?.alimentacaoExterna === 'boolean') resumo.alimentacaoExterna = leitura.telemetria.alimentacaoExterna;
    if (Number.isFinite(leitura.telemetria?.tensaoBateria)) resumo.tensaoBateria = leitura.telemetria.tensaoBateria;
    campos.ultimaLeitura = { $cond: [{ $lte: [{ $ifNull: ['$ultimaLeitura.dataHora', new Date(0)] }, dataHora] },
      { $literal: resumo }, '$ultimaLeitura'] };
    if (gps) campos.ultimoGpsEm = { $max: ['$ultimoGpsEm', dataHora] };
  }
  return Dispositivo.updateOne({
    _id: dispositivo._id, clienteId: dispositivo.clienteId, veiculoId: dispositivo.veiculoId,
    codigoExterno: dispositivo.codigoExterno || { $in: [null, ''] }, ativo: true,
  }, [{ $set: campos }], { updatePipeline: true, timestamps: false });
}

function estadoComunicacao(dispositivo, minutos, agora) {
  if (dispositivo.ativo === false) return 'Desativado';
  if (!dispositivo.ultimaRecepcao) return 'Aguardando dados';
  return agora - new Date(dispositivo.ultimaRecepcao) > minutos * 60000 ? 'Sem comunicação recente' : 'Comunicando';
}

module.exports = { registrarSaude, estadoComunicacao };
