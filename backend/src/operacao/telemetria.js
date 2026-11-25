const intervalos = {
  odometroKm: [0, 10000000], rpm: [0, 15000], combustivelPct: [0, 100], combustivelLitros: [0, 10000],
  temperaturaMotor: [-50, 250], temperaturaCarga: [-100, 200], tensaoBateria: [0, 60],
  horimetroHoras: [0, 1000000], bateriaEquipamentoPct: [0, 100],
  aceleracaoMss: [-30, 30], curvaMss: [-30, 30],
  dpfFuligemPct: [0, 100], dpfRegeneracoesInterrompidas: [0, 1000000],
};
const tiposCamera = ['fadiga', 'distracao', 'celular', 'cinto', 'colisao'];
const validarTelemetria = (raw) => {
  if (raw === undefined) return { dados: undefined, erros: [] };
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { erros: ['Telemetria deve ser um objeto.'] };
  const dados = {}; const erros = [];
  for (const [key, [min, max]] of Object.entries(intervalos)) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (typeof raw[key] !== 'number' || !Number.isFinite(raw[key]) || raw[key] < min || raw[key] > max) erros.push(`Telemetria inválida: ${key}.`);
    else dados[key] = raw[key];
  }
  for (const key of ['portaAberta', 'passageiroPresente', 'alimentacaoExterna', 'dpfLuz']) {
    if (raw[key] === undefined || raw[key] === null) continue;
    if (typeof raw[key] !== 'boolean') erros.push(`Telemetria inválida: ${key}.`); else dados[key] = raw[key];
  }
  if (raw.identificadorMotorista !== undefined) {
    if (typeof raw.identificadorMotorista !== 'string' || !raw.identificadorMotorista.trim() || raw.identificadorMotorista.length > 80) erros.push('Identificação do motorista inválida.');
    else dados.identificadorMotorista = raw.identificadorMotorista.trim();
  }
  if (raw.dtcs !== undefined) {
    if (!Array.isArray(raw.dtcs) || raw.dtcs.length > 30 || raw.dtcs.some((v) => typeof v !== 'string' || !/^[PBCU][0-9A-F]{4}$/i.test(v))) erros.push('Informe até 30 códigos DTC no formato P0000.');
    else dados.dtcs = [...new Set(raw.dtcs.map((v) => v.toUpperCase()))];
  }
  if (raw.eventosCamera !== undefined) {
    if (!Array.isArray(raw.eventosCamera) || raw.eventosCamera.length > 10 || raw.eventosCamera.some((v) => !tiposCamera.includes(v))) erros.push('Evento de câmera não reconhecido.');
    else dados.eventosCamera = [...new Set(raw.eventosCamera)];
  }
  if (raw.rede !== undefined) {
    if (!['celular', 'satelite', 'offline'].includes(raw.rede)) erros.push('Tipo de rede inválido.'); else dados.rede = raw.rede;
  }
  if (raw.dpfRegeneracao !== undefined) {
    if (!['inativa', 'em_andamento', 'concluida', 'interrompida'].includes(raw.dpfRegeneracao)) erros.push('Estado de regeneração do DPF inválido.');
    else dados.dpfRegeneracao = raw.dpfRegeneracao;
  }
  if (raw.eventosDirecao !== undefined) {
    if (!Array.isArray(raw.eventosDirecao) || raw.eventosDirecao.length > 10 || raw.eventosDirecao.some((v) => !['frenagem', 'aceleracao', 'curva'].includes(v))) erros.push('Evento de direção inválido.');
    else dados.eventosDirecao = [...new Set(raw.eventosDirecao)];
  }
  if (raw.rodas !== undefined) {
    if (!Array.isArray(raw.rodas) || raw.rodas.length > 32) erros.push('Envie até 32 rodas.');
    else {
      const ids = new Set();
      dados.rodas = [];
      for (const roda of raw.rodas) {
        if (!roda || typeof roda.id !== 'string' || !/^[\w-]{1,40}$/.test(roda.id) || ids.has(roda.id) ||
            (roda.pressaoKpa === undefined && roda.temperaturaC === undefined) ||
            (roda.pressaoKpa !== undefined && (!Number.isFinite(roda.pressaoKpa) || roda.pressaoKpa < 0 || roda.pressaoKpa > 2500)) ||
            (roda.temperaturaC !== undefined && (!Number.isFinite(roda.temperaturaC) || roda.temperaturaC < -60 || roda.temperaturaC > 250))) {
          erros.push('Informe rodas com identificação única e pressão ou temperatura válida.');
          continue;
        }
        ids.add(roda.id);
        dados.rodas.push({ id: roda.id, ...(roda.pressaoKpa === undefined ? {} : { pressaoKpa: roda.pressaoKpa }),
          ...(roda.temperaturaC === undefined ? {} : { temperaturaC: roda.temperaturaC }) });
      }
    }
  }
  if (raw.sensores !== undefined) {
    const tipos = { temperatura: [-100, 200], bateria: [0, 60], combustivel: [0, 100], porta: null, ocupacao: null };
    if (!Array.isArray(raw.sensores) || raw.sensores.length > 16) erros.push('Envie até 16 sensores.');
    else {
      dados.sensores = []; const ids = new Set();
      for (const s of raw.sensores) {
        if (!s || typeof s.id !== 'string' || !/^[\w-]{1,40}$/.test(s.id) || ids.has(s.id) || !Object.hasOwn(tipos, s.tipo)) { erros.push('Sensor sem identificação única ou tipo válido.'); continue; }
        ids.add(s.id); const faixa = tipos[s.tipo];
        if (faixa ? !Number.isFinite(s.valor) || typeof s.valor !== 'number' || s.valor < faixa[0] || s.valor > faixa[1] : typeof s.valor !== 'boolean') { erros.push(`Leitura inválida no sensor ${s.id}.`); continue; }
        dados.sensores.push({ id: s.id, tipo: s.tipo, valor: s.valor });
      }
    }
  }
  return { erros, dados };
};
const metrosEntre = (a, b) => {
  const rad = (x) => x * Math.PI / 180;
  const x = Math.sin(rad(b.latitude - a.latitude) / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(rad(b.longitude - a.longitude) / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, x))));
};
const eventosTelemetria = (p, anterior, config, cercas = []) => {
  const t = p.telemetria || {}; const eventos = [];
  const add = (tipo, mensagem) => eventos.push({ tipo, mensagem });
  if (p.velocidade > config.limiteVelocidade) add('velocidade', `Velocidade ${p.velocidade} km/h acima do limite ${config.limiteVelocidade}.`);
  if (t.temperaturaCarga !== undefined && (t.temperaturaCarga < config.temperaturaMinima || t.temperaturaCarga > config.temperaturaMaxima)) add('temperatura', `Carga a ${t.temperaturaCarga} °C fora da faixa configurada.`);
  if (t.tensaoBateria !== undefined && t.tensaoBateria < config.tensaoMinima) add('bateria', `Tensão de bateria ${t.tensaoBateria} V.`);
  if (t.aceleracaoMss <= -config.aceleracaoLimite || t.eventosDirecao?.includes('frenagem')) add('frenagem', 'Frenagem brusca informada pelo sensor ou identificada no limite de desaceleração.');
  if (t.aceleracaoMss >= config.aceleracaoLimite || t.eventosDirecao?.includes('aceleracao')) add('aceleracao', 'Aceleração brusca informada pelo sensor ou identificada no limite configurado.');
  if (Math.abs(t.curvaMss || 0) >= config.aceleracaoLimite || t.eventosDirecao?.includes('curva')) add('curva', 'Curva acentuada informada pelo sensor ou identificada no limite lateral.');
  if (t.dtcs?.length) add('diagnostico', `Códigos recebidos do veículo: ${t.dtcs.join(', ')}.`);
  for (const evento of t.eventosCamera || []) add(`camera_${evento}`, `Câmera reportou ${evento}. Evento fornecido pelo equipamento; não há análise de vídeo pelo Linktrac.`);
  for (const sensor of t.sensores || []) {
    if (sensor.tipo === 'temperatura' && (sensor.valor < config.temperaturaMinima || sensor.valor > config.temperaturaMaxima)) add(`sensor_${sensor.id}`, `Sensor ${sensor.id}: temperatura ${sensor.valor} °C fora da faixa.`);
    if (sensor.tipo === 'bateria' && sensor.valor < config.tensaoMinima) add(`sensor_${sensor.id}`, `Sensor ${sensor.id}: bateria ${sensor.valor} V.`);
  }
  if (p.ignicao === true && !p.motoristaId) add('identificacao', 'Ignição ligada sem motorista identificado por integração ou vínculo cadastrado.');
  const intervalo = anterior ? new Date(p.dataHora) - new Date(anterior.dataHora) : NaN;
  if (anterior && intervalo > 0 && intervalo <= config.ausenciaMinutos * 60000) {
    const antes = anterior.telemetria?.combustivelPct;
    if (Number.isFinite(antes) && Number.isFinite(t.combustivelPct) && antes - t.combustivelPct >= config.quedaCombustivel)
      add('combustivel', `Queda de ${Number((antes - t.combustivelPct).toFixed(1))} pontos percentuais de combustível. Conferir medição; não comprova fraude.`);
    for (const cerca of cercas) {
      if (!cerca.ativo || (cerca.vigenciaInicio && Date.parse(p.dataHora) < Date.parse(cerca.vigenciaInicio)) || (cerca.vigenciaFim && Date.parse(p.dataHora) > Date.parse(cerca.vigenciaFim))) continue;
      const dentroAntes = metrosEntre(anterior, cerca) <= cerca.raioMetros;
      const dentroAgora = metrosEntre(p, cerca) <= cerca.raioMetros;
      if (dentroAntes !== dentroAgora) add(`cerca_${cerca.id}_${dentroAgora ? 'entrada' : 'saida'}`, `${dentroAgora ? 'Entrada' : 'Saída'} na área ${cerca.nome}.`);
      if (t.portaAberta && !dentroAgora) add(`porta_${cerca.id}`, `Porta aberta fora da área ${cerca.nome}.`);
    }
  }
  return eventos;
};
module.exports = { validarTelemetria, intervalos, tiposCamera, metrosEntre, eventosTelemetria };
