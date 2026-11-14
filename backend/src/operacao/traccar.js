const converterTraccar = (body, codigoExterno, { aceitarAlarmeSemGps = false } = {}) => {
  const p = body?.position; const device = body?.device;
  if (!p || !device || !codigoExterno || String(device.uniqueId) !== codigoExterno) throw new Error('Identificador externo não corresponde ao equipamento cadastrado.');
  if (!Number.isSafeInteger(p.id) || p.id < 1 || typeof p.fixTime !== 'string' || !Number.isFinite(Date.parse(p.fixTime))) throw new Error('Posição Traccar sem identificador ou horário válido.');
  const a = p.attributes || {}; const t = {};
  const alarmes = typeof a.alarm === 'string' ? a.alarm.split(',').map(valor => valor.trim()) : [];
  const corteAlimentacao = alarmes.includes('powerCut');
  const restaurada = alarmes.includes('powerRestored');
  if (corteAlimentacao !== restaurada) t.alimentacaoExterna = restaurada;
  else if (typeof a.alimentacaoExterna === 'boolean') t.alimentacaoExterna = a.alimentacaoExterna;
  const dataHora = new Date(p.fixTime).toISOString();
  const dataHoraAlimentacao = corteAlimentacao !== restaurada && Number.isFinite(Date.parse(p.deviceTime))
    ? new Date(p.deviceTime).toISOString() : dataHora;
  if (p.valid === false) {
    if (aceitarAlarmeSemGps && corteAlimentacao !== restaurada) {
      return { dataHora: dataHoraAlimentacao, semGPS: true, corteAlimentacao, telemetria: t };
    }
    throw new Error('Coordenada GNSS inválida; envie os sensores pela entrada de telemetria sem GPS.');
  }
  if (Number.isFinite(a.odometer)) t.odometroKm = a.odometer / 1000;
  if (Number.isFinite(a.rpm)) t.rpm = a.rpm;
  if (Number.isFinite(a.coolantTemp)) t.temperaturaMotor = a.coolantTemp;
  if (Number.isFinite(a.temp1)) t.temperaturaCarga = a.temp1;
  // Combustível e tensão variam de unidade por protocolo: exigir normalização no gateway.
  if (typeof a.door === 'boolean') t.portaAberta = a.door;
  if (typeof a.driverUniqueId === 'string') t.identificadorMotorista = a.driverUniqueId;
  const direcao = { hardBraking: 'frenagem', hardAcceleration: 'aceleracao', hardCornering: 'curva' };
  if (direcao[a.alarm]) t.eventosDirecao = [direcao[a.alarm]];
  return { mensagemId: `traccar:${p.id}:${Date.parse(p.fixTime)}`, dataHora,
    ...(typeof t.alimentacaoExterna === 'boolean' ? { dataHoraAlimentacao, corteAlimentacao: corteAlimentacao && !restaurada } : {}),
    latitude: p.latitude, longitude: p.longitude,
    ...(typeof p.speed === 'number' ? { velocidade: Math.round(p.speed * 1.852 * 100) / 100 } : {}), ignicao: typeof a.ignition === 'boolean' ? a.ignition : null, telemetria: t };
};
module.exports = { converterTraccar };
