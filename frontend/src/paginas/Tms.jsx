import { useState } from 'react';

export default function Tms() {
  const [cargas, setCargas] = useState([
    {
      id: 1,
      numero: 'CAR-2026-001',
      origem: 'Brasília - DF',
      destino: 'Goiânia - GO',
      placaVeiculo: 'ABC-1234',
      motorista: 'João Silva',
      status: 'Em rota',
      previsaoEntrega: '15/07/2026',
    },
    {
      id: 2,
      numero: 'CAR-2026-002',
      origem: 'São Paulo - SP',
      destino: 'Belo Horizonte - MG',
      placaVeiculo: 'DEF-5678',
      motorista: 'Carlos Mendes',
      status: 'Aguardando saída',
      previsaoEntrega: '18/07/2026',
    },
  ]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1rem' }}>Gestão de Cargas - TMS</h2>
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Controle de coletas, entregas e acompanhamento de viagens.
      </p>

      <div
        style={{
          background: '#FFFFFF',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              <th style={thStyle}>Número</th>
              <th style={thStyle}>Origem</th>
              <th style={thStyle}>Destino</th>
              <th style={thStyle}>Veículo</th>
              <th style={thStyle}>Motorista</th>
              <th style={thStyle}>Status</th>
              <th style={thStyle}>Previsão</th>
            </tr>
          </thead>
          <tbody>
            {cargas.map((carga) => (
              <tr key={carga.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={tdStyle}>{carga.numero}</td>
                <td style={tdStyle}>{carga.origem}</td>
                <td style={tdStyle}>{carga.destino}</td>
                <td style={tdStyle}>{carga.placaVeiculo}</td>
                <td style={tdStyle}>{carga.motorista}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      backgroundColor: carga.status === 'Em rota' ? '#DBEAFE' : '#FEF3C7',
                      color: carga.status === 'Em rota' ? '#1E40AF' : '#92400E',
                    }}
                  >
                    {carga.status}
                  </span>
                </td>
                <td style={tdStyle}>{carga.previsaoEntrega}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '1rem', textAlign: 'left', color: '#475569', fontWeight: 600 };
const tdStyle = { padding: '1rem', color: '#334155' };
