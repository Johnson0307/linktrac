// src/api/rastreamento.js
import api from './api';

// Envia nova posição com Plus Code e endereço já calculados
export const enviarPosicao = async (dados) => {
  return await api.post('/rastreamento', dados);
};

// Consulta última posição com todos os dados
export const obterUltimaPosicao = async (placa) => {
  return await api.get(`/rastreamento/${placa}`);
};
