import { useState } from 'react';
import api from '../services/api';

export default function Consultar() {
  const [placa, setPlaca] = useState('');
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');

  const buscar = async (e) => {
    e.preventDefault();
    setErro('');
    setDados(null);
    try {
      const resposta = await api.get(`/rastreamento/${placa.toUpperCase()}`);
      setDados(resposta.data);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Erro ao realizar a consulta');
    }
  };

  return (
    <div className="card">
      <h2>Consultar Rastreamento</h2>
      <form onSubmit={buscar}>
        <input
          type="text"
          placeholder="Digite a placa do veículo"
          value={placa}
          onChange={(e) => setPlaca(e.target.value)}
          maxLength={8}
          required
        />
        <button type="submit">Buscar</button>
      </form>

      {erro && <p style={{ color: 'var(--erro)', marginTop: '1rem' }}>{erro}</p>}

      {dados && (
        <div
          style={{
            marginTop: '1.5rem',
            padding: '1rem',
            backgroundColor: '#F5F8FC',
            borderRadius: '8px',
          }}
        >
          <h3>
            {dados.veiculo.marca} {dados.veiculo.modelo}
          </h3>
          <p>
            <strong>Placa:</strong> {dados.veiculo.placa}
          </p>
          <p>
            <strong>Cliente:</strong> {dados.veiculo.cliente}
          </p>

          {dados.localizacao ? (
            <>
              <p>
                <strong>Última localização:</strong> {dados.localizacao.endereco || 'Não informado'}
              </p>
              <p>
                <strong>Coordenadas:</strong> {dados.localizacao.latitude},{' '}
                {dados.localizacao.longitude}
              </p>
              <p>
                <strong>Velocidade:</strong> {dados.localizacao.velocidade} km/h
              </p>
              <p>
                <strong>Status:</strong> {dados.localizacao.status}
              </p>
              <p>
                <strong>Atualizado em:</strong>{' '}
                {new Date(dados.localizacao.dataHora).toLocaleString('pt-BR')}
              </p>
            </>
          ) : (
            <p>Sem dados de localização registrados para este veículo.</p>
          )}
        </div>
      )}
    </div>
  );
}
