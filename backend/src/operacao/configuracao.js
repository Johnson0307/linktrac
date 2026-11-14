const mongoose = require('mongoose');
const campos = {
  limiteVelocidade: { label: 'Limite de velocidade (km/h)', padrao: 80, min: 5, max: 300 },
  ausenciaMinutos: { label: 'Ausência de comunicação (minutos)', padrao: 5, min: 1, max: 1440 },
  intervaloAtualizacao: { label: 'Atualização da última posição (segundos)', padrao: 5, min: 5, max: 300 },
  temperaturaMinima: { label: 'Temperatura mínima de carga (°C)', padrao: -20, min: -100, max: 200 },
  temperaturaMaxima: { label: 'Temperatura máxima de carga (°C)', padrao: 8, min: -100, max: 200 },
  tensaoMinima: { label: 'Tensão mínima da bateria (V)', padrao: 11.5, min: 0, max: 60 },
  aceleracaoLimite: { label: 'Aceleração, frenagem e curva (m/s²)', padrao: 3.5, min: 0.5, max: 20 },
  quedaCombustivel: { label: 'Queda de combustível entre leituras (pontos percentuais)', padrao: 15, min: 1, max: 100 },
};
const padroes = Object.fromEntries(Object.entries(campos).map(([k, v]) => [k, v.padrao]));
const schema = new mongoose.Schema({ clienteId: { type: mongoose.Schema.Types.ObjectId, unique: true, required: true },
  dados: { type: Object, required: true }, atualizadoPor: String,
  whatsappBusiness: { numero: String, numeroIdValidado: String }, }, { timestamps: true });
const Configuracao = mongoose.model('ConfiguracaoEmpresa', schema);
const obterConfig = async (clienteId) => ({ ...padroes, ...(await Configuracao.findOne({ clienteId }).lean())?.dados });
const validarConfig = (body) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { erro: 'Informe as configurações.' };
  const dados = {};
  for (const [key, c] of Object.entries(campos)) {
    const value = body[key];
    if (typeof value !== 'number' || !Number.isFinite(value) || value < c.min || value > c.max)
      return { erro: `${c.label}: use um número entre ${c.min} e ${c.max}.` };
    dados[key] = value;
  }
  if (dados.temperaturaMinima >= dados.temperaturaMaxima) return { erro: 'A temperatura mínima deve ser menor que a máxima.' };
  return { dados };
};
module.exports = { Configuracao, campos, padroes, obterConfig, validarConfig };
