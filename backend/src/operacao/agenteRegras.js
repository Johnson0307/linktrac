const numero = (v) => typeof v === 'number' && Number.isFinite(v);
function validarConfig(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body))
    return { erro: 'Configuração inválida.' };
  const dados = {};
  if (body.monitorar !== undefined) {
    if (typeof body.monitorar !== 'boolean')
      return { erro: 'Monitoramento deve ser verdadeiro ou falso.' };
    dados.monitorar = body.monitorar;
  }
  for (const [key, min, max] of [
    ['temperaturaMotorMax', 40, 150],
    ['tensaoMinima', 1, 60],
  ]) {
    if (body[key] == null || body[key] === '') {
      dados[key] = null;
      continue;
    }
    if (!numero(body[key]) || body[key] < min || body[key] > max)
      return { erro: `Confira ${key}: intervalo ${min} a ${max}.` };
    dados[key] = body[key];
  }
  return { dados };
}
function analisar({
  leituras = [],
  planos = [],
  servicos = [],
  config = {},
  agora = new Date(),
  limitado = false,
}) {
  const fim = +new Date(agora),
    inicio = fim - 7 * 86400000;
  const amostras = leituras
    .filter(
      (p) =>
        +new Date(p.dataHora) >= inicio &&
        +new Date(p.dataHora) <= fim &&
        p.telemetria &&
        Object.values(p.telemetria).some((v) => numero(v) || (Array.isArray(v) && v.length))
    )
    .sort((a, b) => +new Date(a.dataHora) - +new Date(b.dataHora));
  const achados = [];
  const adicionar = (codigo, titulo, recomendacao, evidencias) =>
    achados.push({ codigo, titulo, recomendacao, evidencias });
  const separar = (lista) =>
    lista.reduce((r, p) => {
      if (!r.length || +new Date(p.dataHora) - +new Date(r.at(-1).dataHora) >= 300000) r.push(p);
      return r;
    }, []);
  const evidencia = (p, key) => ({
    dataHora: new Date(p.dataHora).toISOString(),
    campo: key,
    valor: p.telemetria[key],
  });
  if (numero(config.temperaturaMotorMax)) {
    const quentes = separar(
      amostras.filter(
        (p) =>
          p.ignicao === true &&
          numero(p.telemetria.temperaturaMotor) &&
          p.telemetria.temperaturaMotor > config.temperaturaMotorMax
      )
    );
    if (quentes.length >= 3)
      adicionar(
        'temperatura_recorrente',
        'Temperatura do motor acima da faixa em leituras repetidas',
        'Solicitar inspeção do sistema de arrefecimento. Conferir sensor e limite específico do veículo.',
        quentes
          .slice(-5)
          .map((p) => ({ ...evidencia(p, 'temperaturaMotor'), limite: config.temperaturaMotorMax }))
      );
  }
  if (
    numero(config.temperaturaMotorMax) &&
    !achados.some((a) => a.codigo === 'temperatura_recorrente')
  ) {
    const serie = separar(
      amostras.filter((p) => p.ignicao === true && numero(p.telemetria.temperaturaMotor))
    ).slice(-6);
    if (
      serie.length === 6 &&
      +new Date(serie.at(-1).dataHora) - +new Date(serie[0].dataHora) >= 1800000
    ) {
      const media = (itens) =>
        itens.reduce((s, p) => s + p.telemetria.temperaturaMotor, 0) / itens.length;
      if (
        media(serie.slice(3)) - media(serie.slice(0, 3)) >= 10 &&
        serie
          .slice(3)
          .every((p) => p.telemetria.temperaturaMotor >= config.temperaturaMotorMax - 10)
      )
        adicionar(
          'tendencia_temperatura',
          'Elevação de temperatura próxima da referência',
          'Conferir condições de uso, aquecimento normal, sensor e sistema de arrefecimento. A tendência não confirma defeito.',
          serie.map((p) => ({
            ...evidencia(p, 'temperaturaMotor'),
            limite: config.temperaturaMotorMax,
          }))
        );
    }
  }
  if (numero(config.tensaoMinima)) {
    const baixas = separar(
      amostras.filter(
        (p) =>
          numero(p.telemetria.tensaoBateria) && p.telemetria.tensaoBateria < config.tensaoMinima
      )
    );
    if (baixas.length >= 3)
      adicionar(
        'tensao_recorrente',
        'Tensão abaixo da referência em leituras repetidas',
        'Solicitar verificação da bateria, alimentação e sensor. Considerar o estado de ignição e as especificações elétricas.',
        baixas
          .slice(-5)
          .map((p) => ({
            ...evidencia(p, 'tensaoBateria'),
            limite: config.tensaoMinima,
            ignicao: p.ignicao ?? null,
          }))
      );
  }
  const dtcs = new Map();
  for (const p of amostras)
    for (const codigo of p.telemetria.dtcs || []) {
      if (!/^[PBCU][0-9A-F]{4}$/.test(codigo)) continue;
      const lista = dtcs.get(codigo) || [];
      lista.push(p);
      dtcs.set(codigo, lista);
    }
  for (const [codigo, lista] of dtcs) {
    const separados = separar(lista);
    if (separados.length >= 2)
      adicionar(
        `dtc_${codigo}`,
        `Código ${codigo} recebido repetidamente`,
        'Solicitar leitura técnica do diagnóstico. Confirmar significado no manual do fabricante; o código não determina sozinho a peça defeituosa.',
        separados
          .slice(-5)
          .map((p) => ({
            dataHora: new Date(p.dataHora).toISOString(),
            campo: 'dtc',
            valor: codigo,
          }))
      );
  }
  const odometros = amostras.filter((p) => numero(p.telemetria.odometroKm));
  const regressao = odometros.some(
    (p, i) => i > 0 && p.telemetria.odometroKm < odometros[i - 1].telemetria.odometroKm
  );
  const ultimo = odometros.at(-1);
  const proximas = [];
  for (const registro of planos) {
    const d = registro.dados;
    if (!d?.ativo) continue;
    const feitos = servicos
      .filter(
        (s) =>
          String(s.servico).trim().toLowerCase() === String(d.servico).trim().toLowerCase() &&
          +new Date(s.dataServico) <= fim
      )
      .sort((a, b) => +new Date(b.dataServico) - +new Date(a.dataServico));
    const s = feitos[0];
    const data =
      s && +new Date(s.dataServico) >= +new Date(d.ultimaData) ? s.dataServico : d.ultimaData;
    const odo =
      s && +new Date(s.dataServico) >= +new Date(d.ultimaData) ? s.quilometragem : d.ultimoOdometro;
    const vencimento = d.intervaloDias ? +new Date(data) + d.intervaloDias * 86400000 : null;
    const alvo = d.intervaloKm && numero(odo) ? odo + d.intervaloKm : null;
    const porKm =
      alvo !== null &&
      !regressao &&
      ultimo &&
      +new Date(ultimo.dataHora) >= +new Date(data) &&
      ultimo.telemetria.odometroKm >= alvo;
    const porPrazo = vencimento !== null && vencimento <= fim;
    if (porKm || porPrazo)
      adicionar(
        `plano_${registro._id}`,
        `Revisão prevista: ${d.servico}`,
        'Conferir o serviço realizado e programar a revisão conforme o plano cadastrado.',
        [
          {
            campo: 'plano',
            valor: String(registro._id),
            criterio: [porPrazo ? 'prazo' : '', porKm ? 'odometro' : ''].filter(Boolean),
            vencimento: vencimento ? new Date(vencimento).toISOString() : null,
            odometroAlvo: alvo,
            odometroRecebido: ultimo?.telemetria.odometroKm ?? null,
          },
        ]
      );
    else if (vencimento && vencimento <= fim + 7 * 86400000)
      proximas.push({ servico: d.servico, vencimento: new Date(vencimento).toISOString() });
  }
  const ausencias = [];
  if (!amostras.length) ausencias.push('Nenhuma leitura técnica nos últimos sete dias.');
  if (!numero(config.temperaturaMotorMax))
    ausencias.push('Defina a referência de temperatura do motor conforme o fabricante.');
  if (!numero(config.tensaoMinima))
    ausencias.push('Defina a referência elétrica conforme o veículo e o sensor.');
  if (!amostras.some((p) => numero(p.telemetria.temperaturaMotor)))
    ausencias.push('Temperatura do motor não recebida.');
  if (!amostras.some((p) => numero(p.telemetria.tensaoBateria)))
    ausencias.push('Tensão da bateria não recebida.');
  if (!ultimo) ausencias.push('Odômetro do veículo não recebido.');
  if (regressao)
    ausencias.push('Odômetro regrediu; avaliação de manutenção por km suspensa nesta análise.');
  if (amostras.length && fim - +new Date(amostras.at(-1).dataHora) > 86400000)
    ausencias.push('Última leitura técnica há mais de 24 horas.');
  if (
    amostras.length < 3 ||
    (amostras.length &&
      +new Date(amostras.at(-1).dataHora) - +new Date(amostras[0].dataHora) < 600000)
  )
    ausencias.push('Histórico curto para avaliar recorrência e tendências.');
  if (limitado) ausencias.push('Consulta parcial: limite de registros atingido.');
  const status = achados.length
    ? 'inspecao_recomendada'
    : proximas.length
      ? 'revisao_programada'
      : ausencias.length
        ? 'dados_insuficientes'
        : 'em_dia';
  return {
    versao: '1.0',
    status,
    achados,
    proximas,
    ausencias,
    janela: { inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString() },
    quantidade: amostras.length,
    ultimaLeitura: amostras.at(-1)?.dataHora || null,
    limitado,
    criterio:
      'Regras e recorrências observadas; não é previsão de falha nem liberação para circular.',
    passos: [
      'Consultar leituras técnicas dos últimos sete dias',
      'Cruzar planos e serviços registrados',
      'Verificar recorrências, qualidade dos dados e revisões',
      'Preparar recomendações com evidências para o gestor',
    ],
  };
}
module.exports = { analisar, validarConfig };
