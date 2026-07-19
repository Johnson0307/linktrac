import { useState } from 'react';
import { obterUltimaPosicao } from '../api/rastreamento';

const Rastreamento = () => {
  const [placa, setPlaca] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');

  const consultarVeiculo = async (event) => {
    event?.preventDefault?.();
    const placaTrim = placa.trim();
    if (!placaTrim) {
      setErro('Digite a placa do veículo.');
      setResultado(null);
      return;
    }

    setCarregando(true);
    setErro('');
    setResultado(null);

    try {
      const { dados } = await obterUltimaPosicao(placaTrim);
      setResultado(dados);
    } catch (fetchError) {
      setErro(
        fetchError?.mensagem ||
          fetchError?.response?.data?.mensagem ||
          'Não foi possível consultar a posição.'
      );
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h2 style={{ color: '#1E293B', marginBottom: '1.5rem' }}>Rastreamento de Veículos</h2>

      <form
        onSubmit={consultarVeiculo}
        style={{
          display: 'flex',
          gap: '0.8rem',
          alignItems: 'center',
          marginBottom: '2rem',
          flexWrap: 'wrap',
        }}
      >
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
          type="submit"
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
      </form>

      <div
        style={{
          padding: '2rem',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
        }}
      >
        {erro && <p style={{ color: '#DC2626', marginBottom: '1rem' }}>{erro}</p>}

        {!resultado && !erro && (
          <p style={{ color: '#64748B', fontSize: '1.1rem' }}>
            Informe a placa para visualizar a localização em tempo real.
          </p>
        )}

        {resultado && (
          <div style={{ color: '#1E293B', lineHeight: '1.7' }}>
            <h3 style={{ marginBottom: '1rem' }}>Última posição registrada</h3>
            <p>
              <strong>Placa:</strong> {resultado.veiculo.placa}
            </p>
            <p>
              <strong>Veículo:</strong> {resultado.veiculo.marca} {resultado.veiculo.modelo}
            </p>
            <p>
              <strong>Cliente:</strong> {resultado.veiculo.cliente}
            </p>
            <p>
              <strong>Latitude / Longitude:</strong> {resultado.localizacao.coordenadas}
            </p>
            <p>
              <strong>Endereço:</strong> {resultado.localizacao.endereco || 'Não disponível'}
            </p>
            <p>
              <strong>Velocidade:</strong> {resultado.localizacao.velocidade} km/h
            </p>
            <p>
              <strong>Status:</strong> {resultado.localizacao.status}
            </p>
            <p>
              <strong>Registrado em:</strong>{' '}
              {new Date(resultado.localizacao.dataHora).toLocaleString('pt-BR')}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Rastreamento;
