import L from 'leaflet';
import api from '../api/api';

const atribuicao = 'Fiscalização: <a href="https://dados.antt.gov.br/dataset/radar">ANTT</a>, <a href="https://servicos.dnit.gov.br/dadosabertos/dataset/controle-de-velocidade">DNIT</a> e <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

function texto(valor) {
  const elemento = document.createElement('span');
  elemento.textContent = valor;
  return elemento;
}

function resumoRadar(radar) {
  const limites = radar.leve || radar.pesado
    ? [radar.leve && `Leves ${radar.leve} km/h`, radar.pesado && `Pesados ${radar.pesado} km/h`].filter(Boolean).join(' · ')
    : radar.limite ? `${radar.limite} km/h` : 'Limite indisponível nesta fonte';
  return [radar.nome, limites, radar.sentido && `Sentido ${radar.sentido}`, radar.fonte].filter(Boolean).join(' · ');
}

export function prepararCamadaFiscalizacao(mapa) {
  const camada = L.layerGroup();
  const aviso = L.control({ position: 'bottomleft' });
  const rotulo = document.createElement('div');
  rotulo.className = 'mapa-frota-aviso-viario';
  rotulo.setAttribute('role', 'status');
  L.DomEvent.disableClickPropagation(rotulo);
  aviso.onAdd = () => rotulo;
  let consulta;

  async function atualizar() {
    if (!mapa.hasLayer(camada)) return;
    consulta?.abort();
    camada.clearLayers();
    const zoom = mapa.getZoom();
    const limites = mapa.getBounds();
    if (zoom < 12 || limites.getEast() - limites.getWest() > 4 || limites.getNorth() - limites.getSouth() > 4) {
      rotulo.textContent = 'Amplie para ver os radares e barreiras.';
      return;
    }
    rotulo.textContent = 'Consultando a base viária…';
    const controle = new AbortController();
    consulta = controle;
    try {
      const { data: { dados } } = await api.get('/painel/fiscalizacao', {
        signal: controle.signal, params: { zoom, oeste: Math.max(-180, limites.getWest()), sul: Math.max(-90, limites.getSouth()),
          leste: Math.min(180, limites.getEast()), norte: Math.min(90, limites.getNorth()) },
      });
      if (controle.signal.aborted || !mapa.hasLayer(camada)) return;
      for (const via of dados.vias) {
        L.polyline(via.pontos.map(([lng, lat]) => [lat, lng]), { color: '#136d83', weight: 4, attribution: atribuicao })
          .bindTooltip(`${via.limite} km/h`, { sticky: true })
          .bindPopup(texto(`${via.nome} · ${via.limite} km/h · OpenStreetMap`)).addTo(camada);
      }
      for (const radar of dados.radares) {
        const indicador = texto(radar.limite ? '◎' : '◉');
        indicador.className = 'mapa-frota-simbolo-radar';
        L.marker([radar.latitude, radar.longitude], { title: radar.nome, attribution: atribuicao,
          icon: L.divIcon({ className: 'mapa-frota-radar', html: indicador, iconSize: [23, 23], iconAnchor: [11, 11] }),
        }).bindPopup(texto(resumoRadar(radar))).addTo(camada);
      }
      rotulo.textContent = !dados.disponivel ? 'Base viária indisponível.'
        : zoom < 15 ? 'Amplie mais para ver os limites das vias.'
        : !dados.radares.length && !dados.vias.length ? 'Sem dados mapeados nesta área.'
        : 'Limites mapeados. Confira a sinalização.';
    } catch {
      if (!controle.signal.aborted) rotulo.textContent = 'Não foi possível consultar a base viária.';
    }
  }

  camada.on('add', () => { aviso.addTo(mapa); atualizar(); });
  camada.on('remove', () => { consulta?.abort(); aviso.remove(); });
  mapa.on('moveend', atualizar);
  mapa.once('unload', () => consulta?.abort());
  return camada;
}
