// src/api/veiculos.js
import api from './api';

// Cadastrar novo veículo → usa a rota POST /api/veiculos
export const cadastrarVeiculo = async (dadosVeiculo) => {
  try {
    const resposta = await api.post('/veiculos', dadosVeiculo);
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao cadastrar veículo' };
  }
};

// Listar todos os veículos → usa a rota GET /api/veiculos
export const listarTodos = async () => {
  try {
    const resposta = await api.get('/veiculos');
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao listar veículos' };
  }
};

// Buscar veículo pela placa → usa a rota GET /api/veiculos/:placa
export const buscarPorPlaca = async (placa) => {
  try {
    const resposta = await api.get(`/veiculos/${placa.toUpperCase()}`);
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Veículo não encontrado' };
  }
};
