import { useState } from 'react';

export default function Relatorios() {
  const [periodo, setPeriodo] = useState('mes');

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Relatórios e Indicadores</h2>
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Dados consolidados de desempenho, consumo e segurança.
      </p>

      <div style={{ marginBottom: '2rem' }}>
        <label style={{ marginRight: '1rem', fontWeight: 500 }}>Período:</label>
        <select
          value={periodo}
          onChange={(e) => setPeriodo(e.target.value)}
          style={{ padding: '0.5rem 1rem', border: '1px solid #CBD5E1', borderRadius: '4px' }}
        >
          <option value="dia">Último dia</option>
          <option value="semana">Última semana</option>
          <option value="mes">Último mês</option>
          <option value="ano">Último ano</option>
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1.5rem',
        }}
      >
        <div style={cardStyle}>
          <h4 style={tituloCard}>Quilometragem Total</h4>
          <p style={valorCard}>24.850 km</p>
        </div>
        <div style={cardStyle}>
          <h4 style={tituloCard}>Combustível Consumido</h4>
          <p style={valorCard}>3.120 L</p>
        </div>
        <div style={cardStyle}>
          <h4 style={tituloCard}>Custo por km</h4>
          <p style={valorCard}>R$ 1,82</p>
        </div>
        <div style={cardStyle}>
          <h4 style={tituloCard}>Viagens Realizadas</h4>
          <p style={valorCard}>142</p>
        </div>
      </div>
    </div>
  );
}

const cardStyle = {
  background: '#FFFFFF',
  padding: '1.5rem',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};
const tituloCard = { margin: '0 0 0.8rem 0', color: '#64748B', fontSize: '1rem' };
const valorCard = { margin: 0, fontSize: '2rem', fontWeight: 'bold', color: '#1E293B' };
