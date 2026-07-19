import { useState, useEffect } from 'react';
import { listarTodos } from '../api/veiculos';

export default function ListaVeiculos() {
  const [veiculos, setVeiculos] = useState([]);

  useEffect(() => {
    const carregar = async () => {
      try {
        const resposta = await listarTodos();
        setVeiculos(resposta.dados || []);
      } catch (err) {
        setVeiculos([]);
      }
    };
    carregar();
  }, []);

  return (
    <div style={{ padding: '1.5rem' }}>
      <h2>Veículos Cadastrados</h2>
      {veiculos.length === 0 ? (
        <p>Nenhum veículo cadastrado.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f5f5f5' }}>
              <th style={{ border: '1px solid #ddd', padding: '0.6rem' }}>Placa</th>
              <th style={{ border: '1px solid #ddd', padding: '0.6rem' }}>Marca</th>
              <th style={{ border: '1px solid #ddd', padding: '0.6rem' }}>Modelo</th>
              <th style={{ border: '1px solid #ddd', padding: '0.6rem' }}>Ano</th>
            </tr>
          </thead>
          <tbody>
            {veiculos.map((v) => (
              <tr key={v.placa}>
                <td style={{ border: '1px solid #ddd', padding: '0.6rem' }}>{v.placa}</td>
                <td style={{ border: '1px solid #ddd', padding: '0.6rem' }}>{v.marca}</td>
                <td style={{ border: '1px solid #ddd', padding: '0.6rem' }}>{v.modelo}</td>
                <td style={{ border: '1px solid #ddd', padding: '0.6rem' }}>{v.ano}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
