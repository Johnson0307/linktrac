import { createContext, useContext, useEffect, useState } from 'react';
import { login as loginRequest, me as meRequest, register as registerRequest } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(Boolean(token));

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }

    const carregarUsuario = async () => {
      try {
        const resposta = await meRequest();
        setUser(resposta.dados);
      } catch (erro) {
        setUser(null);
        setToken(null);
        localStorage.removeItem('token');
      } finally {
        setLoading(false);
      }
    };

    carregarUsuario();
  }, [token]);

  const login = async (email, senha) => {
    const resposta = await loginRequest(email, senha);
    const { token: novoToken, usuario } = resposta.dados;
    localStorage.setItem('token', novoToken);
    setToken(novoToken);
    setUser(usuario);
    return resposta;
  };

  const register = async (registro) => {
    const resposta = await registerRequest(registro);
    const { token: novoToken, usuario } = resposta.dados;
    localStorage.setItem('token', novoToken);
    setToken(novoToken);
    setUser(usuario);
    return resposta;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, register }}>
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
