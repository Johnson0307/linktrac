import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Register() {
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [slug, setSlug] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [registroSecret, setRegistroSecret] = useState('');
  const [erro, setErro] = useState('');
  const [carregando, setCarregando] = useState(false);
  const { register, user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/', { replace: true });
    }
  }, [loading, user, navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');
    setCarregando(true);

    try {
      await register({
        nomeEmpresa,
        slug,
        cnpj,
        nome,
        email,
        senha,
        role: 'admin',
        registroSecret,
      });
      navigate('/');
    } catch (fetchError) {
      setErro(fetchError?.mensagem || 'Não foi possível concluir o cadastro.');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div
      style={{
        padding: '2rem',
        maxWidth: '520px',
        margin: '3rem auto',
        backgroundColor: '#FFFFFF',
        borderRadius: '12px',
        boxShadow: '0 10px 35px rgba(15, 23, 42, 0.08)',
      }}
    >
      <h2 style={{ color: '#0F172A', marginBottom: '1rem' }}>Cadastro de cliente e usuário</h2>
      <p style={{ color: '#475569', marginBottom: '1.5rem' }}>
        Crie o cliente inicial e um usuário administrador para acessar o painel.
      </p>

      {erro && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{erro}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          Nome da empresa
          <input
            type="text"
            value={nomeEmpresa}
            onChange={(event) => setNomeEmpresa(event.target.value)}
            required
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          Identificador único (slug)
          <input
            type="text"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            required
            placeholder="ex: transportadora-xyz"
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          CNPJ (opcional)
          <input
            type="text"
            value={cnpj}
            onChange={(event) => setCnpj(event.target.value)}
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          Nome do usuário administrador
          <input
            type="text"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            required
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          E-mail
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          Senha
          <input
            type="password"
            value={senha}
            onChange={(event) => setSenha(event.target.value)}
            required
            minLength={6}
            style={{
              padding: '0.85rem 1rem',
              border: '1px solid #CBD5E1',
              borderRadius: '8px',
              fontSize: '1rem',
            }}
          />
        </label>

        <label
          style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', color: '#475569' }}
        >
          Código de registro (opcional)
          <input
            type="text"
            value={registroSecret}
            onChange={(event) => setRegistroSecret(event.target.value)}
            style={{
              padding: '0.85rem 1rem',
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
            padding: '0.95rem 1rem',
            backgroundColor: '#0F172A',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {carregando ? 'Cadastrando...' : 'Cadastrar'}
        </button>
      </form>

      <p style={{ marginTop: '1rem', color: '#475569' }}>
        Já tem conta? <Link to="/login">Faça login</Link>
      </p>
    </div>
  );
}
