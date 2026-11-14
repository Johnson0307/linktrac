const simulado = (v) => v.marca === 'TESTE' && v.modelo === 'SIMULACAO';
const resumirPainel = (veiculos, ultimas, servicos, agora = new Date(), config = {}) => {
  const janelaSegundos = (config.ausenciaMinutos ?? 5) * 60;
  const limiteVelocidade = config.limiteVelocidade ?? 80;
  const reais = veiculos.filter((v) => !simulado(v));
  const porVeiculo = new Map(ultimas.map((p) => [String(p.veiculoId), p]));
  let movimento = 0;
  let semComunicacao = 0;
  let atencao = 0;
  const veiculosMapa = reais.map((v) => {
    const p = porVeiculo.get(String(v._id));
    const idade = p?.dataHora ? agora - new Date(p.dataHora) : NaN;
    const gpsValido = p && p.fonte !== 'simulado' && Number.isFinite(idade) && idade >= 0 &&
      Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 && Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;
    const velocidadeValida = Number.isFinite(p?.velocidade) && p.velocidade >= 0 && p.velocidade <= 300;
    const recente = Boolean(gpsValido && idade <= janelaSegundos * 1000 && p.status !== 'Sem sinal');
    if (!recente || !velocidadeValida) semComunicacao++;
    if (recente && velocidadeValida && p.velocidade > 5) movimento++;
    if (!recente || !velocidadeValida || p.velocidade > limiteVelocidade) atencao++;
    return {
      id: String(v._id), placa: v.placa, ...(v.modelo ? { modelo: v.modelo } : {}), cliente: v.nomeCliente,
      ...(v.iconeMapa ? { iconeMapa: v.iconeMapa } : {}),
      posicao: gpsValido ? {
        latitude: p.latitude, longitude: p.longitude, dataHora: p.dataHora,
        velocidade: velocidadeValida ? p.velocidade : null, recente,
      } : null,
    };
  });
  return { frotaReal: reais.length, emMovimento: movimento, veiculosComAtencao: atencao,
    semComunicacao, servicosRegistrados: servicos, veiculosMapa,
    simulados: veiculos.filter(simulado).map((v) => ({ id: String(v._id), placa: v.placa })),
    atualizadoEm: agora.toISOString(), janelaComunicacaoSegundos: janelaSegundos, limiteVelocidade };
};
module.exports = { simulado, resumirPainel };
