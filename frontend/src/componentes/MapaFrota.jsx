import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import { criarIconeMapa } from '../ajuda/iconesMapaFront';
import { prepararCamadaFiscalizacao } from './camadaFiscalizacao';
import { adicionarControleCamadas, criarCamadasMapa } from './camadasMapa';
import { adicionarFerramentas } from './controlesMapaFrota';
import { atualizarPosicaoMarcador, cancelarMovimento } from './movimentoMarcador';
import './MapaFrota.css';

const vazios = [];
const linkVeiculo = (v) => `/rastreamento?placa=${encodeURIComponent(v.placa)}&veiculoId=${encodeURIComponent(v.id)}`;

function popupVeiculos(veiculos) {
  const caixa = document.createElement('div');
  caixa.className = 'mapa-frota-popup';
  for (const veiculo of veiculos) {
    const item = document.createElement('div');
    const link = document.createElement('a');
    link.href = linkVeiculo(veiculo);
    link.append(criarIconeMapa(veiculo.iconeMapa), ' ', veiculo.placa);
    const detalhe = document.createElement('div');
    const p = veiculo.posicao;
    const hora = new Date(p.dataHora).toLocaleString('pt-BR');
    detalhe.textContent = [veiculo.cliente, p.recente ? 'Posição recente' : 'Última posição conhecida', hora,
      p.velocidade == null ? null : `${p.velocidade} km/h`,
      p.via && `${p.via.nome} · Limite mapeado ${p.via.limite} km/h (${p.via.fonte})`].filter(Boolean).join(' · ');
    item.append(link, detalhe);
    caixa.append(item);
  }
  return caixa;
}

function atualizarVeiculos(estado, veiculos, suavizar) {
  const grupos = new Map();
  for (const veiculo of veiculos) {
    if (!veiculo.posicao) continue;
    const { latitude, longitude } = veiculo.posicao;
    const chave = `${latitude},${longitude}`;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(veiculo);
  }
  const ativos = new Set();
  const localizacoes = [];
  for (const grupo of grupos.values()) {
    const chave = JSON.stringify(grupo.map(v => v.id).sort());
    ativos.add(chave);
    const primeiro = grupo[0];
    const { posicao } = primeiro;
    const recentes = grupo.filter(v => v.posicao.recente).length;
    const classe = recentes === grupo.length ? 'recente' : recentes ? 'misto' : 'antigo';
    const titulo = grupo.length === 1 ? primeiro.placa : `${grupo.length} veículos neste local`;
    const texto = grupo.length > 1 ? String(grupo.length) : primeiro.modelo || primeiro.placa;
    const assinatura = JSON.stringify([classe, titulo, texto, grupo.length === 1 ? primeiro.iconeMapa : null]);
    let item = estado.marcadores.get(chave);
    if (!item) {
      item = { marcador: L.marker([posicao.latitude, posicao.longitude]), posicao };
      estado.marcadores.set(chave, item);
      item.marcador.bindPopup(() => popupVeiculos(item.grupo));
    }
    item.grupo = grupo;
    const { marcador } = item;
    if (item.assinatura !== assinatura) {
      const rotulo = document.createElement('span');
      rotulo.append(criarIconeMapa(grupo.length === 1 ? primeiro.iconeMapa : null), texto);
      Object.assign(marcador.options, { title: titulo, alt: titulo });
      marcador.setIcon(L.divIcon({ className: `mapa-frota-pino ${classe}`, iconSize: null, iconAnchor: [12, 31], html: rotulo }));
      marcador.getElement()?.setAttribute('title', titulo);
      item.assinatura = assinatura;
    }
    if (!estado.camada.hasLayer(marcador)) estado.camada.addLayer(marcador);
    if (!suavizar || item.posicao.dataHora !== posicao.dataHora ||
        item.posicao.latitude !== posicao.latitude || item.posicao.longitude !== posicao.longitude) {
      atualizarPosicaoMarcador(item, posicao, suavizar && grupo.length === 1);
    } else item.posicao = posicao;
    if (marcador.isPopupOpen()) marcador.setPopupContent(popupVeiculos(grupo));
    grupo.forEach(veiculo => localizacoes.push({ veiculo, marcador }));
  }
  for (const [chave, item] of estado.marcadores) {
    if (ativos.has(chave)) continue;
    cancelarMovimento(item);
    estado.camada.removeLayer(item.marcador);
    estado.marcadores.delete(chave);
  }
  estado.localizacoes.splice(0, estado.localizacoes.length, ...localizacoes);
  if (!estado.enquadrouFrota && localizacoes.length && !estado.referenciaSelecionada) {
    estado.centralizar();
    estado.enquadrouFrota = true;
  }
}

export default function MapaFrota({ veiculos = vazios, referencias = vazios, referenciaSelecionada, carregando, erro, acompanhar, aoAcompanhar }) {
  const { user } = useAuth();
  const podePublicar = ['admin', 'gestor'].includes(user?.role) && permite(user, 'entregas', true);
  const container = useRef(null);
  const expandir = useRef(null);
  const estadoMapa = useRef(null);
  const [ampliado, setAmpliado] = useState(false);
  const [erroMapa, setErroMapa] = useState(false);
  const semGps = veiculos.filter(v => !v.posicao);

  useEffect(() => {
    const mapa = L.map(container.current, { scrollWheelZoom: true });
    const { fundos, sobreposicoes } = criarCamadasMapa();
    const localizacoes = [];
    const marcadores = new Map();
    const marcos = referencias.map(referencia => {
      const rotulo = document.createElement('span');
      rotulo.append(criarIconeMapa(referencia.iconeMapa, 'referencia'), referencia.nome);
      const popup = document.createElement('span');
      popup.textContent = referencia.nome;
      const marcador = L.marker([referencia.latitude, referencia.longitude], {
        title: referencia.nome, alt: referencia.nome,
        icon: L.divIcon({ className: 'mapa-frota-pino mapa-frota-referencia', iconSize: null, iconAnchor: [12, 31], html: rotulo }),
      }).bindPopup(popup);
      return { id: referencia._id, marcador };
    });
    const fundoInicial = fundos['Satélite'] ?? fundos.Ruas;
    fundoInicial.addTo(mapa);
    const centralizar = () => {
      if (marcadores.size) mapa.fitBounds(L.latLngBounds([...marcadores.values()].map(({ posicao }) => [posicao.latitude, posicao.longitude])), { paddingTopLeft: [62, 42], paddingBottomRight: [50, 36], maxZoom: 16 });
      else if (marcos.length) mapa.fitBounds(L.featureGroup(marcos.map(m => m.marcador)).getBounds(), { padding: [38, 38], maxZoom: 14 });
      else mapa.setView([-15.8, -47.9], 11);
    };
    centralizar();
    sobreposicoes.Veículos = L.layerGroup().addTo(mapa);
    estadoMapa.current = { marcadores, camada: sobreposicoes.Veículos, localizacoes, centralizar, referenciaSelecionada };
    if (marcos.length) sobreposicoes['Pontos de referência'] = L.layerGroup(marcos.map(m => m.marcador)).addTo(mapa);
    sobreposicoes['Desenhos e KML'] = L.layerGroup().addTo(mapa);
    sobreposicoes['Radares, barreiras e limites'] = prepararCamadaFiscalizacao(mapa);
    adicionarControleCamadas(mapa, fundos, sobreposicoes, { position: 'topleft' });
    adicionarFerramentas(mapa, localizacoes, centralizar, sobreposicoes['Desenhos e KML'], sobreposicoes.Veículos, podePublicar);
    const selecionado = marcos.find(m => m.id === referenciaSelecionada)?.marcador;
    if (selecionado) {
      mapa.setView(selecionado.getLatLng(), 16);
      selecionado.openPopup();
    }
    setErroMapa(false);
    for (const layer of Object.values(fundos)) {
      layer.on('tileerror', () => { if (mapa.hasLayer(layer)) setErroMapa(true); });
    }
    mapa.on('baselayerchange', () => setErroMapa(false));
    const tamanho = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => mapa.invalidateSize());
    tamanho?.observe(container.current);
    return () => {
      tamanho?.disconnect();
      marcadores.forEach(cancelarMovimento);
      estadoMapa.current = null;
      mapa.getContainer().classList.remove('mapa-frota-desenhando');
      mapa.remove();
    };
  }, [referencias, referenciaSelecionada, podePublicar]);

  useEffect(() => {
    if (estadoMapa.current) atualizarVeiculos(estadoMapa.current, veiculos, acompanhar);
  }, [veiculos, acompanhar, referencias, referenciaSelecionada, podePublicar]);

  useEffect(() => {
    if (!ampliado) return undefined;
    const recolher = e => {
      if (e.key === 'Escape') {
        setAmpliado(false);
        expandir.current?.focus();
      }
    };
    window.addEventListener('keydown', recolher);
    return () => window.removeEventListener('keydown', recolher);
  }, [ampliado]);

  return <section className={`mapa-frota${ampliado ? ' mapa-frota--ampliado' : ''}`} aria-labelledby="titulo-mapa-frota">
    <header className="mapa-frota-cabecalho">
      <div>
        <h2 id="titulo-mapa-frota">Mapa da frota</h2>
        {!carregando && !erro && <p>{veiculos.length - semGps.length} de {veiculos.length} veículos com posição</p>}
      </div>
      <div className="mapa-frota-acoes">
        {aoAcompanhar && <button type="button" aria-pressed={acompanhar} onClick={aoAcompanhar}>Acompanhar movimento</button>}
        <button ref={expandir} type="button" aria-expanded={ampliado} aria-controls="mapa-frota-area"
          onClick={() => setAmpliado(valor => !valor)}>{ampliado ? 'Recolher mapa' : 'Expandir mapa'}</button>
      </div>
    </header>
    {erroMapa && <p className="mapa-frota-aviso">O fundo do mapa está indisponível. As posições recebidas continuam acessíveis nos marcadores.</p>}
    <div id="mapa-frota-area" ref={container} className="mapa-frota-area" role="region" aria-label="Posições dos veículos e pontos de referência" />
    <div className="mapa-frota-rodape">
      {carregando && <p>Consultando as posições...</p>}
      {erro && <p>Não foi possível atualizar as posições. O mapa mantém a última consulta disponível.</p>}
      {acompanhar && !erro && <p>Movimento suavizado entre posições recebidas do GPS.</p>}
      {!carregando && !erro && !veiculos.length && <p>Nenhum veículo real disponível para sua conta.</p>}
      {!carregando && !erro && veiculos.length > semGps.length && <p className="mapa-frota-legenda">
        <span className="recente">Posição recente</span><span className="antigo">Última posição conhecida</span>
        <span>Um número indica veículos na mesma localização.</span>
      </p>}
      {!carregando && !erro && semGps.length > 0 && <details>
        <summary>Veículos sem posição registrada ({semGps.length})</summary>
        <ul>{semGps.map(v => <li key={v.id}><Link to={linkVeiculo(v)}>{v.placa}</Link>{v.cliente && ` · ${v.cliente}`}</li>)}</ul>
      </details>}
    </div>
  </section>;
}
