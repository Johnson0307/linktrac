import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import MapaTrajeto from '../componentes/MapaTrajeto';
import AlertasViariosRota from './AlertasViariosRota';
import './CentralOperacao.css';
import './MinhasRotas.css';

const caminho = '/tms/rotas-mapa';
const mensagem = erro => erro.response?.data?.mensagem || 'Não foi possível consultar a rota.';
const dataHora = data => new Date(data).toLocaleString('pt-BR');
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const veiculo = rota => [rota.veiculoId?.placa, rota.veiculoId?.modelo].filter(Boolean).join(' · ') || 'Veículo indisponível';
const coordenadas = p => `${p.latitude},${p.longitude}`;

export default function MinhasRotas() {
  const { user } = useAuth();
  if (!['admin', 'gestor', 'motorista'].includes(user?.role)) return <p>Esta tela é destinada a motoristas e gestores.</p>;
  return <PainelRotas motorista={user.role === 'motorista'}
    podeCancelar={user.role !== 'motorista' && permite(user, 'entregas', true)} />;
}

function PainelRotas({ motorista, podeCancelar }) {
  const [params] = useSearchParams();
  const id = params.get('rota');
  const [resultado, setResultado] = useState(null);
  const [detalhe, setDetalhe] = useState(null);
  const [erroLista, setErroLista] = useState('');
  const [erroDetalhe, setErroDetalhe] = useState('');
  const [versao, setVersao] = useState(0);
  const rota = detalhe?._id === id ? detalhe : null;
  const pontos = useMemo(() => rota && [
    { ...rota.origem, legenda: 'Partida', dataHora: rota.createdAt },
    ...(rota.passagens || []).map((p, i) => ({ ...p, legenda: `Passagem ${i + 1}`, dataHora: rota.createdAt })),
    { ...rota.destino, legenda: 'Destino', dataHora: rota.createdAt },
  ], [rota]);

  useEffect(() => {
    const controle = new AbortController();
    setErroLista('');
    api.get(caminho, { signal: controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setResultado(data);
    }).catch(erro => {
      if (!controle.signal.aborted) setErroLista(mensagem(erro));
    });
    return () => controle.abort();
  }, [versao]);

  useEffect(() => {
    setErroDetalhe('');
    setDetalhe(null);
    if (!id) return;
    const controle = new AbortController();
    api.get(`${caminho}/${encodeURIComponent(id)}`, { signal: controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setDetalhe(data.dados);
    }).catch(erro => {
      if (!controle.signal.aborted) setErroDetalhe(mensagem(erro));
    });
    return () => controle.abort();
  }, [id, versao]);

  return <div className="central-page rotas-atribuidas">
    <AcoesDaPagina>
      {id && <Link to="/minhas-rotas">Voltar para a lista</Link>}
      <button type="button" onClick={() => setVersao(v => v + 1)}>Atualizar rotas</button>
    </AcoesDaPagina>
    {id ? <>
      {erroDetalhe && <p role="alert">{erroDetalhe}</p>}
      {!rota && !erroDetalhe && <p role="status">Carregando rota…</p>}
      {rota && <DetalheRota rota={rota} pontos={pontos} motorista={motorista} podeCancelar={podeCancelar}
        aoCancelar={canceladaEm => {
          setDetalhe(atual => atual?._id === rota._id ? { ...atual, canceladaEm } : atual);
          setResultado(atual => atual && { ...atual, dados: atual.dados.map(item =>
            item._id === rota._id ? { ...item, canceladaEm } : item) });
        }} />}
    </> : <>
      {erroLista && <p role="alert">{erroLista}</p>}
      {!resultado && !erroLista && <p role="status">Carregando rotas…</p>}
      {resultado?.dados.length === 0 && <p>Nenhuma rota atribuída.</p>}
      {resultado?.limitado && <p>Exibindo as 50 rotas mais recentes.</p>}
      <ul className="rotas-lista">{resultado?.dados.map(item => <li className="central-card" key={item._id}>
        <Link to={`?rota=${encodeURIComponent(item._id)}`}><strong>{item.titulo}</strong></Link>
        <p>{veiculo(item)}{!motorista && item.motoristaId && ` · ${item.motoristaId.nome}`}</p>
        <p>{dataHora(item.createdAt)}{item.canceladaEm && ' · Cancelada'}</p>
      </li>)}</ul>
    </>}
  </div>;
}

function DetalheRota({ rota, pontos, motorista, podeCancelar, aoCancelar }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const parametros = new URLSearchParams({
    api: '1', destination: coordenadas(rota.destino),
    travelmode: 'driving', dir_action: 'navigate',
  });
  if (rota.passagens?.length) parametros.set('waypoints', rota.passagens.map(coordenadas).join('|'));

  async function cancelar() {
    if (!window.confirm('Cancelar a rota e retirá-la da lista do motorista?')) return;
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.put(`${caminho}/${rota._id}/cancelar`);
      aoCancelar(data.dados.canceladaEm);
    } catch (erro) { setErro(mensagem(erro)); }
    finally { setOcupado(false); }
  }

  return <article className="central-card rota-atribuida">
    <h2>{rota.titulo}</h2>
    <p>{veiculo(rota)}{rota.motoristaId && ` · ${rota.motoristaId.nome}`}</p>
    <p>{numero.format(rota.distanciaKm)} km {rota.porRuas ? 'por ruas' : 'em linha reta'}
      {rota.duracaoSegundos != null && ` · ${Math.max(1, Math.round(rota.duracaoSegundos / 60))} min estimados`}</p>
    {rota.passagens?.length > 0 && <p>Pontos de passagem obrigatórios na ordem do mapa: {rota.passagens.length}.</p>}
    {rota.canceladaEm ? <p>Cancelada em {dataHora(rota.canceladaEm)}</p> : <div className="rota-atribuida-acoes">
      <a className="rota-atribuida-navegar" href={`https://www.google.com/maps/dir/?${parametros}`} target="_blank"
        rel="noopener noreferrer">Navegar até o destino</a>
      {podeCancelar && <button type="button" disabled={ocupado} onClick={cancelar}>Cancelar rota</button>}
    </div>}
    {motorista && !rota.canceladaEm && <AlertasViariosRota key={rota._id} rotaId={rota._id} />}
    {erro && <p role="alert">{erro}</p>}
    <MapaTrajeto posicoes={pontos} geometria={rota.geometria} modo="rota" />
    {rota.provedor === 'osrm' && <small>Dados viários © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a></small>}
  </article>;
}
