import { useState, useEffect } from 'react';
import { cadastrarVeiculo, listarTodos } from '../api/veiculos';

const Veiculos = () => {
  const [veiculos, setVeiculos] = useState([]);
  const [form, setForm] = useState({
    placa: '',
    marca: '',
    modelo: '',
    ano: '',
    cor: '',
    nomeCliente: '',
    telefone: '',
    ativo: true,
  });
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    const carregarVeiculos = async () => {
      try {
        const resposta = await listarTodos();
        setVeiculos(resposta.dados || []);
      } catch (err) {
        console.error('Erro ao carregar veículos:', err);
        setErro('Não foi possível carregar os veículos.');
      }
    };

    carregarVeiculos();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      const resposta = await cadastrarVeiculo(form);
      const novoVeiculo = resposta.dados;
      setVeiculos((prev) => [novoVeiculo, ...prev]);
      setMensagem('Veículo cadastrado com sucesso.');
      setForm({
        placa: '',
        marca: '',
        modelo: '',
        ano: '',
        cor: '',
        nomeCliente: '',
        telefone: '',
        ativo: true,
      });
    } catch (err) {
      setErro(err?.mensagem || (err?.erros ? err.erros.join(' ') : 'Erro ao cadastrar veículo.'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Gestão de Veículos</h2>

      <div
        style={{
          background: '#F8FAFC',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Cadastrar Novo Veículo</h3>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          }}
        >
          {erro && <p style={{ color: '#DC2626' }}>{erro}</p>}
          {mensagem && <p style={{ color: '#16A34A' }}>{mensagem}</p>}
          <input
            type="text"
            name="placa"
            placeholder="Placa"
            value={form.placa}
            onChange={(e) => setForm((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="marca"
            placeholder="Marca"
            value={form.marca}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="modelo"
            placeholder="Modelo"
            value={form.modelo}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="number"
            name="ano"
            placeholder="Ano"
            value={form.ano}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="cor"
            placeholder="Cor"
            value={form.cor}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="text"
            name="nomeCliente"
            placeholder="Nome do cliente"
            value={form.nomeCliente}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="tel"
            name="telefone"
            placeholder="Telefone"
            value={form.telefone}
            onChange={handleChange}
            style={inputStyle}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input type="checkbox" name="ativo" checked={form.ativo} onChange={handleChange} />
            Ativo
          </label>

          <button type="submit" style={buttonStyle} disabled={carregando}>
            {carregando ? 'Cadastrando...' : 'Cadastrar Veículo'}
          </button>
        </form>
      </div>

      <div>
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Veículos Cadastrados</h3>
        {veiculos.length === 0 ? (
          <p style={{ color: '#64748B' }}>Nenhum veículo cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {veiculos.map((v) => (
              <div
                key={v._id || v.id || v.placa}
                style={{
                  padding: '1rem',
                  background: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <strong>{v.placa}</strong> — {v.marca} {v.modelo} ({v.ano})
                <br />
                Cliente: {v.nomeCliente || 'Não informado'}
                <br />
                {v.telefone && (
                  <>
                    Telefone: {v.telefone} <br />
                  </>
                )}
                <span style={{ color: v.ativo ? '#047857' : '#B91C1C' }}>
                  {v.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const inputStyle = {
  padding: '0.6rem',
  border: '1px solid #CBD5E1',
  borderRadius: '4px',
  fontSize: '1rem',
};

const buttonStyle = {
  padding: '0.6rem',
  backgroundColor: '#0099FF',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '500',
};

export default Veiculos;
