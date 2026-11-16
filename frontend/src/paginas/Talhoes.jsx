import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import { adicionarControleCamadas, criarCamadasMapa } from '../componentes/camadasMapa';
import './CentralOperacao.css';

const caminho = '/operacao/agro';
const vazio = [];
const decimal = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });
const mensagem = (e, texto) => e.response?.data?.mensagem || texto;
const coordenadas = pontos => pontos.map(p => [p.latitude, p.longitude]);

function MapaTalhao({ vertices, segmentos, selecionado, centro, desenhando, adicionar }) {
  const elemento = useRef(null);
  const mapa = useRef(null);
  const camadas = useRef(null);
  const manipulador = useRef(null);
  useEffect(() => { manipulador.current = desenhando ? adicionar : null; }, [desenhando, adicionar]);
  useEffect(() => {
    const instancia = L.map(elemento.current).setView([-15.8, -47.9], 9);
    const { fundos, sobreposicoes } = criarCamadasMapa();
    fundos.Ruas.addTo(instancia);
    adicionarControleCamadas(instancia, fundos, sobreposicoes);
    mapa.current = instancia;
    camadas.current = L.layerGroup().addTo(instancia);
    instancia.on('click', e => manipulador.current?.({
      latitude: Number(e.latlng.lat.toFixed(7)), longitude: Number(instancia.wrapLatLng(e.latlng).lng.toFixed(7)),
    }));
    const observador = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => instancia.invalidateSize()) : null;
    observador?.observe(elemento.current);
    return () => {
      observador?.disconnect();
      instancia.remove();
      mapa.current = null;
    };
  }, []);
  useEffect(() => {
    const grupo = camadas.current;
    grupo.clearLayers();
    const pontos = coordenadas(vertices);
    if (pontos.length > 2) L.polygon(pontos, { color: '#176238', fillOpacity: 0.17, interactive: false }).addTo(grupo);
    else if (pontos.length > 1) L.polyline(pontos, { color: '#176238', interactive: false }).addTo(grupo);
    if (desenhando) for (const ponto of pontos) L.circleMarker(ponto, { color: '#176238', radius: 4, interactive: false }).addTo(grupo);
    if (segmentos.length) L.polyline(segmentos, { color: '#145acc', weight: 3, interactive: false }).addTo(grupo);
  }, [vertices, segmentos, desenhando]);
  useEffect(() => {
    if (selecionado) mapa.current.fitBounds(coordenadas(selecionado.vertices), { padding: [25, 25], maxZoom: 18 });
  }, [selecionado]);
  useEffect(() => {
    if (centro) mapa.current.setView([centro.latitude, centro.longitude], 16);
  }, [centro]);
  return <div ref={elemento} role="region" aria-label="Mapa do talhão"
    style={{ height: 420, borderRadius: 8, position: 'relative', zIndex: 0, cursor: desenhando ? 'crosshair' : undefined }} />;
}

export default function Talhoes() {
  const { user } = useAuth();
  const podeEditar = permite(user, 'operacao', true);
  const [dados, setDados] = useState(null);
  const [talhaoId, setTalhaoId] = useState('');
  const [veiculoId, setVeiculoId] = useState('');
  const [edicao, setEdicao] = useState(null);
  const [centro, setCentro] = useState(null);
  const [periodo, setPeriodo] = useState({ inicio: '', fim: '', largura: '' });
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    const abortar = new AbortController();
    api.get(caminho, { signal: abortar.signal }).then(({ data }) => {
      setDados(data.dados);
      setTalhaoId(data.dados.talhoes[0]?._id || '');
    }).catch(e => { if (!abortar.signal.aborted) setErro(mensagem(e, 'Não foi possível carregar os talhões.')); });
    return () => abortar.abort();
  }, [user.clienteId]);

  const selecionado = dados?.talhoes.find(t => t._id === talhaoId);
  const vertices = edicao?.vertices || selecionado?.vertices || vazio;
  async function executar(acao, texto) {
    setErro('');
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e, texto));
    } finally {
      setOcupado(false);
    }
  }

  function salvar(e) {
    e.preventDefault();
    executar(async () => {
      const { data } = edicao._id ? await api.put(`${caminho}/${edicao._id}`, edicao) : await api.post(caminho, edicao);
      const atualizado = data.dados;
      setDados(atual => ({ ...atual, talhoes: [...atual.talhoes.filter(t => t._id !== atualizado._id), atualizado]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')) }));
      setTalhaoId(atualizado._id);
      setEdicao(null);
      setResultado(null);
    }, 'Não foi possível salvar o talhão.');
  }

  function consultar(e) {
    e.preventDefault();
    setResultado(null);
    executar(async () => {
      const { data } = await api.get(`${caminho}/${talhaoId}/area`, {
        params: { veiculoId, largura: Number(periodo.largura), inicio: new Date(periodo.inicio).toISOString(),
          fim: new Date(periodo.fim).toISOString() }, timeout: 25000,
      });
      setResultado(data.dados);
    }, 'Não foi possível calcular a área neste período.');
  }

  return <div className="central-page">
    {erro && <p role="alert">{erro}</p>}
    {!dados && !erro && <p>Carregando talhões…</p>}
    {dados && <>
      <section className="central-card">
        <div className="central-form">
          <label>Talhão<select value={talhaoId} disabled={ocupado || Boolean(edicao)} onChange={e => {
            setTalhaoId(e.target.value); setResultado(null);
          }}>
            <option value="">Selecione</option>
            {dados.talhoes.map(t => <option key={t._id} value={t._id}>{t.nome}</option>)}
          </select></label>
          <label>Máquina<select value={veiculoId} disabled={ocupado} onChange={e => {
            setVeiculoId(e.target.value); setResultado(null);
          }}>
            <option value="">Selecione</option>
            {dados.maquinas.map(m => <option key={m._id} value={m._id}>{m.placa} · {m.marca} {m.modelo}</option>)}
          </select></label>
        </div>
        <button type="button" disabled={!veiculoId || ocupado} onClick={() => executar(async () => {
          const { data } = await api.get(`${caminho}/maquinas/${veiculoId}/posicao`);
          setCentro(data.dados);
        }, 'Não foi possível localizar a máquina.')}>Centralizar na máquina</button>
        {podeEditar && !edicao && <>
          <button type="button" disabled={ocupado} onClick={() => { setEdicao({ nome: '', vertices: [] }); setResultado(null); }}>Novo talhão</button>
          <button type="button" disabled={!selecionado || ocupado} onClick={() => {
            setEdicao({ _id: selecionado._id, nome: selecionado.nome, vertices: selecionado.vertices }); setResultado(null);
          }}>Editar talhão</button>
        </>}
        {edicao && <form onSubmit={salvar}>
          <label>Nome do talhão<input required maxLength={100} disabled={ocupado} value={edicao.nome}
            onChange={e => setEdicao(atual => ({ ...atual, nome: e.target.value }))} /></label>
          <p>Clique no mapa para marcar o contorno em ordem. O desenho fecha ao salvar. {vertices.length} vértices.</p>
          <button type="button" disabled={!vertices.length || ocupado} onClick={() => setEdicao(atual => ({
            ...atual, vertices: atual.vertices.slice(0, -1),
          }))}>Desfazer ponto</button>
          <button type="button" disabled={!vertices.length || ocupado} onClick={() => setEdicao(atual => ({ ...atual, vertices: [] }))}>Redesenhar</button>
          <button type="submit" disabled={vertices.length < 3 || ocupado}>Salvar talhão</button>
          <button type="button" disabled={ocupado} onClick={() => setEdicao(null)}>Cancelar</button>
        </form>}
        {selecionado && !edicao && <p>Área cadastrada do talhão {decimal.format(selecionado.areaHa)} ha.</p>}
        <MapaTalhao vertices={vertices} segmentos={resultado?.segmentos || vazio} selecionado={selecionado}
          centro={centro} desenhando={Boolean(edicao) && !ocupado} adicionar={ponto => setEdicao(atual =>
            atual && atual.vertices.length < 80 ? { ...atual, vertices: [...atual.vertices, ponto] } : atual)} />
      </section>
      {selecionado && !edicao && <section className="central-card">
        <h2>Área trabalhada estimada</h2>
        <form className="central-form" onSubmit={consultar}>
          {[['inicio', 'Início', 'datetime-local'], ['fim', 'Fim', 'datetime-local'], ['largura', 'Largura do implemento (m)', 'number']]
            .map(([campo, label, tipo]) => <label key={campo}>{label}<input required type={tipo} disabled={ocupado} value={periodo[campo]}
              {...(tipo === 'number' ? { min: 1, max: 60, step: '0.01' } : {})}
              onChange={e => { setPeriodo(atual => ({ ...atual, [campo]: e.target.value })); setResultado(null); }} /></label>)}
          <button disabled={ocupado || !veiculoId}>Calcular área</button>
        </form>
        {resultado && <p role="status"><strong>{decimal.format(resultado.areaTrabalhadaHa)} ha estimados</strong> de
          {' '}{decimal.format(resultado.areaTalhaoHa)} ha · {resultado.posicoes} posições analisadas.
          {resultado.segmentos.length === 0 && ' Nenhum trecho elegível no período.'}</p>}
        <p>O cálculo usa posições com ignição ligada e velocidade de trabalho. A linha azul mostra os trechos usados.
          Passagens sobre a mesma faixa contam uma vez. Selecione somente o horário da operação agrícola.</p>
      </section>}
    </>}
  </div>;
}
