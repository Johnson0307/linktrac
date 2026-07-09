import { useState } from 'react';

export default function Manutencao() {
  const [manutencoes] = useState([
    {
      id: 1,
      placa: 'ABC-1234',
      tipo: 'Troca de pastilhas',
      quilometragem: 42000,
      previsao: '800 km restantes',
      status: 'Atenção',
    },
    {
      id: 2,
      placa: 'DEF-5678',
      tipo: 'Verificação de bateria',
      quilometragem: 65000,
      previsao: '15 dias',
      status: 'Normal',
    },
    {
      id: 3,
      placa: 'GHI-9012',
      tipo: 'Troca de óleo',
      quilometragem: 30000,
      previsao: 'Vencida',
      status: 'Urgente',
    },
  ]);

  return (
    <div style={{ padding: '1.5rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Manutenção Preditiva</h2>
      <p style={{ color: '#64748B', marginBottom: '2rem' }}>
        Acompanhamento de desgaste e previsão de serviços.
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
            <tr style={{ background: '#F8FAFC', textAlign: 'left' }}>
              <th style={thStyle}>Placa</th>
              <th style={thStyle}>Serviço</th>
              <th style={thStyle}>Quilometragem</th>
              <th style={thStyle}>Previsão</th>
              <th style={thStyle}>Status</th>
            </tr>
          </thead>
          <tbody>
            {manutencoes.map((item) => (
              <tr key={item.id} style={{ borderBottom: '1px solid #E2E8F0' }}>
                <td style={tdStyle}>{item.placa}</td>
                <td style={tdStyle}>{item.tipo}</td>
                <td style={tdStyle}>{item.quilometragem.toLocaleString('pt-BR')} km</td>
                <td style={tdStyle}>{item.previsao}</td>
                <td style={tdStyle}>
                  <span
                    style={{
                      padding: '0.25rem 0.75rem',
                      borderRadius: '12px',
                      fontSize: '0.85rem',
                      fontWeight: 500,
                      backgroundColor:
                        item.status === 'Urgente'
                          ? '#FEE2E2'
                          : item.status === 'Atenção'
                            ? '#FEF3C7'
                            : '#ECFCCB',
                      color:
                        item.status === 'Urgente'
                          ? '#991B1B'
                          : item.status === 'Atenção'
                            ? '#92400E'
                            : '#166534',
                    }}
                  >
                    {item.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const thStyle = { padding: '1rem', fontWeight: 600, color: '#475569' };
const tdStyle = { padding: '1rem', color: '#334155' };
