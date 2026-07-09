import { useState, useEffect } from 'react';

const Veiculos = () => {
  const [veiculos, setVeiculos] = useState([]);
  const [form, setForm] = useState({
    placa: '',
    modelo: '',
    marca: '',
    ano: '',
    tipo: '',
    hodometroAtual: '',
    numeroRastreador: '',
    temCanBus: false,
    sensores: [],
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Veículo cadastrado:', form);
    // Aqui depois envia para a API
    setVeiculos((prev) => [...prev, { ...form, id: Date.now() }]);
    setForm({
      placa: '',
      modelo: '',
      marca: '',
      ano: '',
      tipo: '',
      hodometroAtual: '',
      numeroRastreador: '',
      temCanBus: false,
      sensores: [],
    });
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Gestão de Veículos</h2>

      {/* Formulário de Cadastro */}
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
          <input
            type="text"
            name="placa"
            placeholder="Placa"
            value={form.placa}
            onChange={handleChange}
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
            name="tipo"
            placeholder="Tipo (Caminhão, Van, etc)"
            value={form.tipo}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="number"
            name="hodometroAtual"
            placeholder="Quilometragem Inicial"
            value={form.hodometroAtual}
            onChange={handleChange}
            style={inputStyle}
          />
          <input
            type="text"
            name="numeroRastreador"
            placeholder="ID do Rastreador"
            value={form.numeroRastreador}
            onChange={handleChange}
            style={inputStyle}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <input
              type="checkbox"
              name="temCanBus"
              checked={form.temCanBus}
              onChange={handleChange}
              id="canbus"
            />
            <label htmlFor="canbus">Possui leitura CAN Bus</label>
          </div>

          <button type="submit" style={buttonStyle}>
            Cadastrar Veículo
          </button>
        </form>
      </div>

      {/* Lista de Veículos */}
      <div>
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Veículos Cadastrados</h3>
        {veiculos.length === 0 ? (
          <p style={{ color: '#64748B' }}>Nenhum veículo cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {veiculos.map((v) => (
              <div
                key={v.id}
                style={{
                  padding: '1rem',
                  background: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <strong>{v.placa}</strong> — {v.marca} {v.modelo} ({v.ano})
                <br />
                Quilometragem: {v.hodometroAtual} km | Rastreador: {v.numeroRastreador}
                {v.temCanBus && (
                  <span style={{ marginLeft: '1rem', color: '#0099FF' }}> • CAN Bus ativo</span>
                )}
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
