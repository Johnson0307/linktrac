import { useState } from 'react';
const duracao = (segundos) => {
  const valor = Math.floor(segundos);
  return `${Math.floor(valor / 3600)}h ${Math.floor((valor % 3600) / 60)}min ${valor % 60}s`;
};
const local = (p) => p.endereco || `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`;
export default function HistoricoAtividade({ atividade, limitado }) {
  const [tipo, setTipo] = useState('viagem');
  if (!atividade) return null;
  const { resumo, trechos } = atividade;
  const visiveis = trechos.filter((t) => t.tipo === tipo);
  return <section aria-label="Viagens e paradas" style={{ padding: '1rem', margin: '1rem 0', background: '#FFFFFF', borderRadius: 8 }}>
    <h4>Viagens e paradas estimadas</h4>
    <p>Calculadas pelas velocidades das posições: acima de 5 km/h indica movimento. Início e fim são os horários observados, sem confirmação de ignição ou de viagem completa.</p>
    <p>A distância é aproximada, somando linhas entre os pontos em movimento. Não é a quilometragem do veículo.</p>
    {limitado && <p>Resumo parcial: considera somente as 500 posições exibidas.</p>}
    {atividade.intervalosDesconhecidos > 0 && <p role="status">
      {atividade.intervalosDesconhecidos} intervalos sem dados suficientes ({duracao(atividade.tempoDesconhecidoSegundos)}).
      Lacunas acima de 5 minutos e posições sem sinal não são contadas como movimento nem parada.
    </p>}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', margin: '1rem 0' }}>
      <span><strong>Movimento:</strong> {duracao(resumo.tempoMovimentoSegundos)}</span>
      <span><strong>Parado:</strong> {duracao(resumo.tempoParadoSegundos)}</span>
      <span><strong>Distância estimada:</strong> {resumo.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km</span>
    </div>
    <div role="group" aria-label="Tipo de atividade" style={{ display: 'flex', gap: '1rem' }}>
      <button type="button" aria-pressed={tipo === 'viagem'} onClick={() => setTipo('viagem')}>Viagens ({resumo.viagens})</button>
      <button type="button" aria-pressed={tipo === 'parada'} onClick={() => setTipo('parada')}>Paradas ({resumo.paradas})</button>
    </div>
    {!visiveis.length ? <p>Nenhum trecho de {tipo === 'viagem' ? 'movimento' : 'parada'} identificado. São necessárias pelo menos duas posições válidas próximas no tempo.</p> :
      <div style={{ overflowX: 'auto', marginTop: '1rem' }}><table style={{ width: '100%', textAlign: 'left' }}>
        <caption>{tipo === 'viagem' ? 'Trechos em movimento' : 'Trechos parados'} no período consultado</caption>
        <thead><tr><th>Início observado</th><th>Fim observado</th><th>Duração</th><th>Local inicial</th><th>Local final</th>{tipo === 'viagem' && <><th>Distância estimada</th><th>Velocidade máxima registrada</th></>}</tr></thead>
        <tbody>{visiveis.map((t, i) => <tr key={`${t.inicio}-${i}`}>
          <td>{new Date(t.inicio).toLocaleString('pt-BR')}</td><td>{new Date(t.fim).toLocaleString('pt-BR')}</td><td>{duracao(t.duracaoSegundos)}</td>
          <td>{local(t.origem)}</td><td>{local(t.destino)}</td>
          {tipo === 'viagem' && <><td>{t.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km</td><td>{t.velocidadeMaxima} km/h</td></>}
        </tr>)}</tbody>
      </table></div>}
  </section>;
}
