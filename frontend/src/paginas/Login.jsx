import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMarca } from '../contexts/MarcaContext';
import { useAuth } from '../contexts/AuthContext';
import useCadastroInicial from '../contexts/useCadastroInicial';

export default function Login() {
  const [identificador, setIdentificador] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { login, user, loading } = useAuth();
  const { marca } = useMarca();
  const { modo: modoCadastro } = useCadastroInicial();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!loading && user) {
      navigate(location.state?.from?.pathname || '/', { replace: true });
    }
  }, [loading, user, navigate, location.state]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await login(identificador, senha);
      navigate(location.state?.from?.pathname || '/');
    } catch (fetchError) {
      setErro(fetchError?.mensagem || 'Não foi possível fazer login.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '420px',
        margin: '4rem auto',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 8px 30px rgba(15, 23, 42, 0.1)',
      }}
    >
      <h2 style={{ color: '#1E293B', marginBottom: '1rem' }}>Entrar em {marca.nome}</h2>
      {erro && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{erro}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#475569' }}
        >
          CPF ou CNPJ
          <input
            type="text"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={250}
            value={identificador}
            onChange={(event) => setIdentificador(event.target.value)}
            required
            style={{
              padding: '0.9rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
          <small>Se sua conta antiga usa e-mail, informe o e-mail aqui.</small>
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', color: '#475569' }}
        >
          Senha
          <input
            type="password"
            autoComplete="current-password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            style={{
              padding: '0.9rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <button
          type="submit"
          disabled={carregando}
          style={{
            padding: '0.9rem 1rem',
            backgroundColor: '#0099FF',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {carregando ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', color: '#475569' }}>
        {modoCadastro === 'inicial' || modoCadastro === 'codigo'
          ? <Link to="/register">Cadastro inicial</Link>
          : 'Precisa de acesso? Solicite seu cadastro à administração da sua empresa.'}
      </p>
    </div>
  );
}
