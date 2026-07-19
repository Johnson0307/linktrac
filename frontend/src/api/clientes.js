import api from './api';

export const buscarCliente = async () => {
  try {
    const resposta = await api.get('/cliente');
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao buscar dados do cliente.' };
  }
};
