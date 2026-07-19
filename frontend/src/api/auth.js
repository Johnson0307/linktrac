import api from './api';

const tratarErro = (erro, mensagemPadrao) => {
  return erro.response?.data || { mensagem: mensagemPadrao };
};

export const login = async (email, senha) => {
  try {
    const resposta = await api.post('/auth/login', { email, senha });
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Falha ao efetuar login.');
  }
};

export const register = async (registro) => {
  try {
    const resposta = await api.post('/auth/register', registro);
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Falha ao registrar usuário.');
  }
};

export const me = async () => {
  try {
    const resposta = await api.get('/auth/me');
    return resposta.data;
  } catch (erro) {
    throw tratarErro(erro, 'Falha ao buscar dados de usuário.');
  }
};
