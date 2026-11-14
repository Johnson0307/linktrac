import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { adicionarControleCamadas, criarCamadasMapa } from './camadasMapa';

const semCercas = [];
const coordenadaValida = (p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude) &&
  Math.abs(p.latitude) <= 90 && Math.abs(p.longitude) <= 180;

export default function MapaTrajeto({ posicoes, geometria, cercas = semCercas, modo = 'trajeto' }) {
  const container = useRef(null);
  const camadasEscolhidas = useRef({ fundo: 'Ruas', visiveis: {} });
  const [erroMapa, setErroMapa] = useState(false);
  useEffect(() => {
    const pontos = posicoes.filter(coordenadaValida);
    if (!container.current || !pontos.length) return undefined;
    setErroMapa(false);
    const mapa = L.map(container.current, { scrollWheelZoom: true });
    const { fundos, sobreposicoes } = criarCamadasMapa();
    const marcadores = L.layerGroup();
    const nomeMarcadores = { posicao: 'Veículo', rota: 'Paradas', trajeto: 'Posições registradas' }[modo];
    sobreposicoes[nomeMarcadores] = marcadores;
    const coordenadas = pontos.map((p) => [p.latitude, p.longitude]);
    const linha = geometria?.length > 1 ? geometria.map(([lon, lat]) => [lat, lon]) : coordenadas;
    if (linha.length > 1) sobreposicoes.Trajeto = L.polyline(linha, { color: '#0066CC', weight: 4, interactive: false });
    pontos.forEach((p, index) => {
      const legenda = document.createElement('div');
      legenda.textContent = p.legenda ? p.legenda + ' — ' + new Date(p.dataHora).toLocaleString('pt-BR') : `${index === 0 ? 'Início' : index === pontos.length - 1 ? 'Fim' : `Ponto ${index + 1}`} — ${new Date(p.dataHora).toLocaleString('pt-BR')} — ${p.velocidade} km/h`;
      L.circleMarker([p.latitude, p.longitude], {
        radius: index === 0 || index === pontos.length - 1 ? 7 : 4,
        color: index === 0 ? '#15803D' : index === pontos.length - 1 ? '#B91C1C' : '#0066CC',
        fillOpacity: 0.9,
      }).bindPopup(legenda).addTo(marcadores);
    });
    const circulos = cercas.filter(c => coordenadaValida(c) && Number.isFinite(c.raioMetros) && c.raioMetros > 0)
      .map(c => {
        const legenda = document.createElement('div');
        legenda.textContent = c.nome;
        return L.circle([c.latitude, c.longitude], {
          radius: c.raioMetros, color: '#6D28D9', fillOpacity: 0.12, dashArray: '6 4',
        }).bindPopup(legenda);
      });
    if (circulos.length) sobreposicoes['Cercas virtuais'] = L.layerGroup(circulos);
    const { fundo, visiveis } = camadasEscolhidas.current;
    Object.values(fundos).forEach(layer => layer.on('tileerror', () => {
      if (mapa.hasLayer(layer)) setErroMapa(true);
    }));
    (fundos[fundo] || fundos.Ruas).addTo(mapa);
    mapa.fitBounds(L.latLngBounds([...coordenadas, ...linha]), { padding: [30, 30], maxZoom: 17 });
    for (const [nome, layer] of Object.entries(sobreposicoes)) {
      if (visiveis[nome] ?? (nome === nomeMarcadores || nome === 'Trajeto')) layer.addTo(mapa);
    }
    mapa.on('baselayerchange', ({ name }) => { camadasEscolhidas.current.fundo = name; setErroMapa(false); });
    mapa.on('overlayadd overlayremove', ({ name, type }) => { visiveis[name] = type === 'overlayadd'; });
    adicionarControleCamadas(mapa, fundos, sobreposicoes);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => mapa.invalidateSize()) : null;
    observer?.observe(container.current);
    return () => { observer?.disconnect(); mapa.remove(); };
  }, [posicoes, geometria, cercas, modo]);
  return <>
    {erroMapa && <p role="alert">O fundo do mapa não carregou. As posições continuam disponíveis na tabela.</p>}
    <div ref={container} role="region" aria-label={modo === 'posicao' ? 'Mapa da última posição' : 'Mapa do trajeto'} style={{ height: modo === 'posicao' ? 300 : 380, width: '100%', position: 'relative', zIndex: 0, borderRadius: 8 }} />
    {modo !== 'posicao' && <p style={{ color: '#64748B' }}>{geometria?.length > 1 ? 'Trajeto calculado por ruas.' : 'A linha liga os pontos em linha reta.'} Início em verde e fim em vermelho.</p>}
  </>;
}
