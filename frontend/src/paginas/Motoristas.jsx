import { useState } from 'react';
export default function Motorista() {
  const [motoristas, setMotoristas] = useState([]);
  const [form, setForm] = useState({
    nome: '',
    cpf: '',
    cnh: '',
    validadeCnh: '',
    categoriaCnh: '',
    telefone: '',
    email: '',
    endereco: '',
    status: 'ativo',
    observacoes: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Motorista cadastrado:', form);
    setMotoristas((prev) => [...prev, { ...form, id: Date.now() }]);
    setForm({
      nome: '',
      cpf: '',
      cnh: '',
      validadeCnh: '',
      categoriaCnh: '',
      telefone: '',
      email: '',
      endereco: '',
      status: 'ativo',
      observacoes: '',
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Gestão de Motoristas</h2>

      {/* Formulário de Cadastro */}
      <div
        style={{
          background: '#F8FAFC',
          padding: '1.5rem',
          borderRadius: '8px',
          marginBottom: '2rem',
        }}
      >
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Cadastrar Novo Motorista</h3>
        <form
          onSubmit={handleSubmit}
          style={{
            display: 'grid',
            gap: '1rem',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          }}
        >
          <input
            type="text"
            name="nome"
            placeholder="Nome completo"
            value={form.nome}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="cpf"
            placeholder="CPF"
            value={form.cpf}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="text"
            name="cnh"
            placeholder="Número da CNH"
            value={form.cnh}
            onChange={handleChange}
            required
            style={inputStyle}
          />
          <input
            type="date"
            name="validadeCnh"
            value={form.validadeCnh}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <select
            name="categoriaCnh"
            value={form.categoriaCnh}
            onChange={handleChange}
            required
            style={inputStyle}
          >
            <option value="">Selecione a categoria</option>
            <option value="A">A</option>
            <option value="B">B</option>
            <option value="C">C</option>
            <option value="D">D</option>
            <option value="E">E</option>
          </select>

          <input
            type="tel"
            name="telefone"
            placeholder="Telefone"
            value={form.telefone}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="email"
            name="email"
            placeholder="E-mail"
            value={form.email}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="text"
            name="endereco"
            placeholder="Endereço completo"
            value={form.endereco}
            onChange={handleChange}
            style={inputStyle}
          />

          <select name="status" value={form.status} onChange={handleChange} style={inputStyle}>
            <option value="ativo">Ativo</option>
            <option value="inativo">Inativo</option>
            <option value="ferias">Em férias</option>
          </select>

          <textarea
            name="observacoes"
            placeholder="Observações adicionais"
            value={form.observacoes}
            onChange={handleChange}
            rows="2"
            style={{ ...inputStyle, gridColumn: '1 / -1' }}
          />

          <button type="submit" style={buttonStyle}>
            Cadastrar Motorista
          </button>
        </form>
      </div>

      {/* Lista de Motoristas */}
      <div>
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Motoristas Cadastrados</h3>
        {motoristas.length === 0 ? (
          <p style={{ color: '#64748B' }}>Nenhum motorista cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {motoristas.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: '1rem',
                  background: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  borderLeft: m.status === 'ativo' ? '4px solid #10B981' : '4px solid #EF4444',
                }}
              >
                <strong>{m.nome}</strong>
                <br />
                CNH: {m.cnh} | Validade: {new Date(m.validadeCnh).toLocaleDateString('pt-BR')}
                <br />
                Telefone: {m.telefone} | Status:{' '}
                {m.status.charAt(0).toUpperCase() + m.status.slice(1)}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

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
