import api from './api';

export const listarUsuarios = async () => {
  try {
    const resposta = await api.get('/usuarios');
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao listar usuários.' };
  }
};

export const criarUsuario = async (dadosUsuario) => {
  try {
    const resposta = await api.post('/usuarios', dadosUsuario);
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao criar usuário.' };
  }
};

export const atualizarUsuario = async (id, dadosUsuario) => {
  try {
    const resposta = await api.put(`/usuarios/${id}`, dadosUsuario);
    return resposta.data;
  } catch (erro) {
    throw erro.response?.data || { mensagem: 'Erro ao atualizar usuário.' };
  }
};
