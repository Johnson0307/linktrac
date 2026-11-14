// src/api/rastreamento.js
import api from './api';

export const obterHistorico = async (placa, { veiculoId, inicio, fim } = {}) => {
  const params = new URLSearchParams();
  if (veiculoId) params.set('veiculoId', veiculoId);
  if (inicio) params.set('inicio', inicio);
  if (fim) params.set('fim', fim);
  try {
    const resposta = await api.get(`/rastreamento/${encodeURIComponent(placa.trim().toUpperCase())}/historico?${params}`);
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Não foi possível consultar o histórico.');
  }
};

const tratarErro = (erro, mensagemPadrao) => {
  // padroniza para sempre retornar { sucesso:false, mensagem: '...' }
  const dados = erro.response?.data;
  if (dados?.mensagem) return dados;
  if (dados?.erro) return { sucesso: false, mensagem: dados.erro };
  return { sucesso: false, mensagem: mensagemPadrao };
};

// Envia nova posição com Plus Code e endereço já calculados
export const enviarPosicao = async (dados) => {
  try {
    const resposta = await api.post('/rastreamento', dados);
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Erro ao enviar posição de rastreamento.');
  }
};

// Consulta última posição com todos os dados
export const obterUltimaPosicao = async (placa, veiculoId) => {
  try {
    const resposta = await api.get(
      `/rastreamento/${encodeURIComponent(placa.trim().toUpperCase())}${veiculoId ? `?veiculoId=${encodeURIComponent(veiculoId)}` : ''}`
    );
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Erro ao buscar rastreamento.');
  }
};
