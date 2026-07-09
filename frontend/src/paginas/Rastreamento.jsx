import { useState } from 'react';

const Rastreamento = () => {
  const [placa, setPlaca] = useState('');
  const [carregando, setCarregando] = useState(false);

  const consultarVeiculo = async () => {
    if (!placa.trim()) return alert('Digite a placa do veículo');
    setCarregando(true);

    // Aqui depois você conecta com sua API/MongoDB
    console.log('Buscando dados para placa:', placa.toUpperCase());

    // Simulação de busca
    setTimeout(() => {
      setCarregando(false);
      alert('Consulta realizada! Em breve conectamos com seu banco.');
    }, 800);
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Rastreamento de Veículos</h2>

      <div style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', marginBottom: '2rem' }}>
        <input
          type="text"
          placeholder="Digite a placa (ex: ABC1234)"
          value={placa}
          onChange={(e) => setPlaca(e.target.value.toUpperCase())}
          style={{
            padding: '0.7rem 1rem',
            border: '1px solid #CBD5E1',
            borderRadius: '6px',
            fontSize: '1rem',
            minWidth: '260px',
          }}
        />
        <button
          onClick={consultarVeiculo}
          disabled={carregando}
          style={{
            padding: '0.7rem 1.4rem',
            backgroundColor: '#0090FF',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '1rem',
            fontWeight: '500',
          }}
        >
          {carregando ? 'Buscando...' : 'Consultar'}
        </button>
      </div>

      <div
        style={{
          padding: '2rem',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
          textAlign: 'center',
        }}
      >
        <p style={{ color: '#64748B', fontSize: '1.1rem' }}>
          Informe a placa para visualizar a localização em tempo real
        </p>
      </div>
    </div>
  );
};

export default Rastreamento;
