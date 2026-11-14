import { createContext, useContext, useEffect, useState } from 'react';
import { login as loginRequest, me as meRequest, register as registerRequest } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(Boolean(token));
  const [sessionError, setSessionError] = useState('');
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    let ativo = true;
    if (!token) {
      setUser(null);
      setSessionError('');
      setLoading(false);
      return;
    }
    setLoading(true);
    setSessionError('');

    const carregarUsuario = async () => {
      try {
        const resposta = await meRequest();
        if (!ativo) return;
        setUser(resposta.dados);
      } catch (erro) {
        if (!ativo) return;
        if (erro.status === 401) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('token');
        } else {
          setSessionError('Não foi possível verificar sua sessão. Tente novamente.');
        }
      } finally {
        if (ativo) setLoading(false);
      }
    };

    carregarUsuario();
    return () => {
      ativo = false;
    };
  }, [token, tentativa]);

  const retrySession = () => {
    setLoading(true);
    setTentativa((valor) => valor + 1);
  };

  const login = async (identificador, senha) => {
    const resposta = await loginRequest(identificador, senha);
    const { token: novoToken, usuario } = resposta.dados;
    localStorage.setItem('token', novoToken);
    setLoading(true);
    setToken(novoToken);
    setUser(usuario);
    return resposta;
  };

  const register = async (registro) => {
    const resposta = await registerRequest(registro);
    const { token: novoToken, usuario } = resposta.dados;
    localStorage.setItem('token', novoToken);
    setLoading(true);
    setToken(novoToken);
    setUser(usuario);
    return resposta;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setSessionError('');
  };

  return (
    <AuthContext.Provider
      value={{ user, token, loading, sessionError, retrySession, login, logout, register }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
