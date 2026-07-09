import { useState, useEffect } from 'react';

export default function Dashboard() {
  // Dados de exemplo — depois virão da API
  const [resumo, setResumo] = useState({
    totalVeiculos: 0,
    veiculosEmRota: 0,
    motoristasAtivos: 0,
    alertasPendentes: 0,
    consumoMedio: '0 km/L',
    manutencoesAbertas: 0,
  });

  useEffect(() => {
    // Simula carregamento de dados
    setResumo({
      totalVeiculos: 12,
      veiculosEmRota: 7,
      motoristasAtivos: 9,
      alertasPendentes: 3,
      consumoMedio: '8,4 km/L',
      manutencoesAbertas: 2,
    });
  }, []);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
      <h1 style={{ color: '#1E293B', marginBottom: '0.5rem' }}>Bem-vindo ao LinkTrac Prime</h1>
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Sistema de rastreamento e gestão de frotas.
      </p>

      {/* Cards de indicadores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1.2rem',
          marginBottom: '2rem',
        }}
      >
        <div style={cardStyle}>
          <h4 style={labelStyle}>Total de Veículos</h4>
          <p style={valorStyle}>{resumo.totalVeiculos}</p>
        </div>
        <div style={cardStyle}>
          <h4 style={labelStyle}>Em Rota</h4>
          <p style={{ ...valorStyle, color: '#10B981' }}>{resumo.veiculosEmRota}</p>
        </div>
        <div style={cardStyle}>
          <h4 style={labelStyle}>Motoristas Ativos</h4>
          <p style={{ ...valorStyle, color: '#3B82F6' }}>{resumo.motoristasAtivos}</p>
        </div>
        <div style={cardStyle}>
          <h4 style={labelStyle}>Alertas Pendentes</h4>
          <p style={{ ...valorStyle, color: '#F59E0B' }}>{resumo.alertasPendentes}</p>
        </div>
        <div style={cardStyle}>
          <h4 style={labelStyle}>Consumo Médio</h4>
          <p style={{ ...valorStyle, color: '#8B5CF6' }}>{resumo.consumoMedio}</p>
        </div>
        <div style={cardStyle}>
          <h4 style={labelStyle}>Manutenções</h4>
          <p style={{ ...valorStyle, color: '#EF4444' }}>{resumo.manutencoesAbertas}</p>
        </div>
      </div>

      {/* Últimos alertas */}
      <div
        style={{
          background: '#FFFFFF',
          padding: '1.5rem',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <h3 style={{ color: '#334155', marginBottom: '1rem' }}>Últimos Alertas</h3>
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          <li style={linhaAlerta}>⚠️ Placa ABC-1234: Bateria com tensão baixa</li>
          <li style={linhaAlerta}>🛠️ Placa DEF-5678: Troca de pastilhas prevista em ~800 km</li>
          <li style={linhaAlerta}>🚗 Motorista Carlos: Frenagens bruscas acima do normal</li>
        </ul>
      </div>
    </div>
  );
}

// Estilos auxiliares
const cardStyle = {
  background: '#FFFFFF',
  padding: '1.2rem',
  borderRadius: '8px',
  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
};
const labelStyle = {
  margin: '0 0 0.4rem 0',
  fontSize: '0.95rem',
  color: '#64748B',
  fontWeight: '500',
};
const valorStyle = {
  margin: 0,
  fontSize: '1.8rem',
  fontWeight: 'bold',
  color: '#1E293B',
};
const linhaAlerta = {
  padding: '0.7rem 0',
  borderBottom: '1px solid #F1F5F9',
  fontSize: '0.95rem',
  color: '#334155',
};
