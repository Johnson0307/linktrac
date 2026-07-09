// src/componentes/CardPosicao.jsx
export default function CardPosicao({ posicao }) {
  if (!posicao) return <p>Nenhuma posição recebida</p>;

  return (
    <div style={{ border: '1px solid #ddd', padding: '1rem', borderRadius: '8px' }}>
      <h4>Placa: {posicao.placa}</h4>
      <p>
        <strong>Data/Hora:</strong> {new Date(posicao.dataHora).toLocaleString('pt-BR')}
      </p>
      <p>
        <strong>Coordenadas:</strong> {posicao.latitude.toFixed(6)}, {posicao.longitude.toFixed(6)}
      </p>
      <p>
        <strong>Plus Code:</strong> {posicao.plusCode || 'A gerar...'}
      </p>
      <p>
        <strong>Endereço:</strong> {posicao.enderecoCompleto || 'A buscar...'}
      </p>
    </div>
  );
}
