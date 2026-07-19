// src/api/rastreamento.js
import api from './api';

const tratarErro = (erro, mensagemPadrao) => {
  return erro.response?.data || { mensagem: mensagemPadrao };
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
export const obterUltimaPosicao = async (placa) => {
  try {
    const resposta = await api.get(`/rastreamento/${placa}`);
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Erro ao buscar rastreamento.');
  }
};
