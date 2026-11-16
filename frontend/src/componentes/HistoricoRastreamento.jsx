import { useEffect, useState } from 'react';
import { obterHistorico } from '../api/rastreamento';
import ReplayTrajeto from './ReplayTrajeto';
import HistoricoAtividade from './HistoricoAtividade';

export default function HistoricoRastreamento({ placa, veiculoId }) {
  const [inicio, setInicio] = useState('');
  const [fim, setFim] = useState('');
  const [consulta, setConsulta] = useState({});
  const [historico, setHistorico] = useState(null);
  const [erro, setErro] = useState('');
  const [erroFiltro, setErroFiltro] = useState('');
  const [carregando, setCarregando] = useState(true);
  useEffect(() => {
    let atual = true;
    setCarregando(true); setErro(''); setHistorico(null);
    obterHistorico(placa, { veiculoId, ...consulta })
      .then((dados) => { if (atual) setHistorico(dados); })
      .catch((e) => { if (atual) setErro(e.mensagem || 'Não foi possível consultar o histórico.'); })
      .finally(() => { if (atual) setCarregando(false); });
    return () => { atual = false; };
  }, [placa, veiculoId, consulta]);
  const consultar = (event) => {
    event.preventDefault();
    if ((inicio && !Number.isFinite(Date.parse(inicio))) || (fim && !Number.isFinite(Date.parse(fim))) ||
      (inicio && fim && Date.parse(inicio) > Date.parse(fim))) {
      setErroFiltro('Informe um período válido, com início anterior ao fim.'); return;
    }
    setErroFiltro('');
    setConsulta({ inicio: inicio ? new Date(inicio).toISOString() : undefined, fim: fim ? new Date(fim).toISOString() : undefined });
  };
  return <section style={{ marginTop: '2rem' }} aria-label="Histórico de posições">
    <h3>Histórico e trajeto</h3>
    <form onSubmit={consultar} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: '1rem', margin: '1rem 0' }}>
      <label>Início <input aria-label="Início do período" type="datetime-local" value={inicio} onChange={(e) => setInicio(e.target.value)} /></label>
      <label>Fim <input aria-label="Fim do período" type="datetime-local" value={fim} onChange={(e) => setFim(e.target.value)} /></label>
      <button disabled={carregando} type="submit">{carregando ? 'Carregando histórico...' : 'Consultar histórico'}</button>
      <button disabled={carregando} type="button" onClick={() => { setInicio(''); setFim(''); setErroFiltro(''); setConsulta({}); }}>Limpar período</button>
    </form>
    <p>Datas no horário deste dispositivo. Sem período, são exibidas até 500 posições mais recentes.</p>
    {(erro || erroFiltro) && <p role="alert">{erroFiltro || erro}</p>}
    {historico && <>
      <p>{historico.quantidade} posições encontradas.</p>
      <HistoricoAtividade atividade={historico.atividade} limitado={historico.limitado} />
      {historico.limitado && <p role="status">Exibindo somente as 500 posições mais recentes deste período. Reduza o período para consultar os demais pontos.</p>}
      {!historico.dados.length ? <p>Nenhuma posição encontrada neste período.</p> : <>
        <ReplayTrajeto posicoes={historico.dados} cercas={historico.cercas} />
        <div style={{ overflowX: 'auto', maxHeight: 400, marginTop: '1rem' }}>
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
            <caption>Posições em ordem de registro, da mais antiga à mais recente</caption>
            <thead><tr><th>Data e hora</th><th>Velocidade</th><th>Status</th><th>Coordenadas</th><th>Endereço</th></tr></thead>
            <tbody>{historico.dados.map((p) => <tr key={p._id} style={{ borderBottom: '1px solid #CBD5E1' }}>
              <td>{new Date(p.dataHora).toLocaleString('pt-BR')}</td><td>{p.velocidade} km/h</td><td>{p.status}</td>
              <td>{p.latitude}, {p.longitude}</td><td>{p.endereco || 'Não disponível'}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </>}
  </section>;
}
