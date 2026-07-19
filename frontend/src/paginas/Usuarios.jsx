import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { buscarCliente } from '../api/clientes';
import { criarUsuario, listarUsuarios } from '../api/usuarios';

const rolesDisponiveis = [
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'operador', label: 'Operador' },
  { value: 'motorista', label: 'Motorista' },
];

export default function Usuarios() {
  const { user } = useAuth();
  const [cliente, setCliente] = useState(null);
  const [usuarios, setUsuarios] = useState([]);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [form, setForm] = useState({ nome: '', email: '', senha: '', role: 'operador' });

  useEffect(() => {
    const carregarDados = async () => {
      try {
        const [clienteResposta, usuariosResposta] = await Promise.all([buscarCliente(), listarUsuarios()]);
        setCliente(clienteResposta.dados);
        setUsuarios(usuariosResposta.dados);
      } catch (erroApi) {
        setErro(erroApi.mensagem || 'Falha ao carregar os dados.');
      }
    };

    if (user) {
      carregarDados();
    }
  }, [user]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErro('');
    setSucesso('');
    setCarregando(true);

    try {
      await criarUsuario(form);
      setSucesso('Usuário criado com sucesso.');
      setForm({ nome: '', email: '', senha: '', role: 'operador' });
      const usuariosResposta = await listarUsuarios();
      setUsuarios(usuariosResposta.dados);
    } catch (erroApi) {
      setErro(erroApi.mensagem || 'Falha ao criar usuário.');
    } finally {
      setCarregando(false);
    }
  };

  if (!user || !['admin', 'gestor'].includes(user.role)) {
    return (
      <div style={{ padding: '2rem', color: '#334155' }}>
        <h2>Acesso negado</h2>
        <p>Somente administradores e gestores podem acessar a página de usuários.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '960px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ color: '#1E293B' }}>Gestão de usuários</h2>
          <p style={{ color: '#64748B', marginTop: '0.5rem' }}>
            Gerencie o acesso da sua equipe aos dados da frota e ao painel.
          </p>
          {cliente && (
            <div style={{ marginTop: '1rem', color: '#475569' }}>
              <strong>Cliente:</strong> {cliente.nome} &bull; <strong>Slug:</strong> {cliente.slug}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gap: '1.5rem', marginTop: '1.5rem' }}>
        <section style={{ background: '#FFFFFF', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Cadastrar novo usuário</h3>
          {erro && <p style={{ color: '#dc2626', marginBottom: '1rem' }}>{erro}</p>}
          {sucesso && <p style={{ color: '#16a34a', marginBottom: '1rem' }}>{sucesso}</p>}

          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={labelStyle}>
                Nome
                <input name="nome" value={form.nome} onChange={handleChange} required style={inputStyle} />
              </label>
              <label style={labelStyle}>
                E-mail
                <input name="email" type="email" value={form.email} onChange={handleChange} required style={inputStyle} />
              </label>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <label style={labelStyle}>
                Senha
                <input name="senha" type="password" value={form.senha} onChange={handleChange} required minLength={6} style={inputStyle} />
              </label>
              <label style={labelStyle}>
                Papel
                <select name="role" value={form.role} onChange={handleChange} style={inputStyle}>
                  {rolesDisponiveis.map((roleOption) => (
                    <option key={roleOption.value} value={roleOption.value}>
                      {roleOption.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <button type="submit" disabled={carregando} style={buttonStyle}>
              {carregando ? 'Salvando...' : 'Criar usuário'}
            </button>
          </form>
        </section>

        <section style={{ background: '#FFFFFF', padding: '1.5rem', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
          <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Usuários do cliente</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #E2E8F0' }}>
                  <th style={thStyle}>Nome</th>
                  <th style={thStyle}>E-mail</th>
                  <th style={thStyle}>Perfil</th>
                  <th style={thStyle}>Ativo</th>
                  <th style={thStyle}>Criado em</th>
                </tr>
              </thead>
              <tbody>
                {usuarios.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '1rem', color: '#64748B' }}>
                      Nenhum usuário encontrado.
                    </td>
                  </tr>
                ) : (
                  usuarios.map((usuario) => (
                    <tr key={usuario._id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                      <td style={tdStyle}>{usuario.nome}</td>
                      <td style={tdStyle}>{usuario.email}</td>
                      <td style={tdStyle}>{usuario.role}</td>
                      <td style={tdStyle}>{usuario.ativo ? 'Sim' : 'Não'}</td>
                      <td style={tdStyle}>{new Date(usuario.dataCadastro).toLocaleDateString()}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: '0.35rem',
  color: '#475569',
};

const inputStyle = {
  padding: '0.9rem 1rem',
  border: '1px solid #CBD5E1',
  borderRadius: '8px',
  fontSize: '1rem',
};

const buttonStyle = {
  padding: '0.95rem 1rem',
  backgroundColor: '#0099FF',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '8px',
  fontWeight: '600',
  cursor: 'pointer',
};

const thStyle = {
  padding: '0.9rem 0.75rem',
  color: '#475569',
  fontWeight: '600',
};

const tdStyle = {
  padding: '0.9rem 0.75rem',
  color: '#334155',
};
