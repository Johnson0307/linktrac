import L from 'leaflet';
import { abrirRotaNoMapa } from './rotaNoMapa';

const ferramentas = {
  linha: ['╱', 'Medir distância', 'Marque os pontos da linha.'],
  poligono: ['⬟', 'Desenhar polígono', 'Marque pelo menos três vértices.'],
  circulo: ['○', 'Desenhar círculo', 'Marque o centro e depois um ponto no contorno.'],
  ponto: ['♦', 'Adicionar marcador', 'Clique no local que deseja marcar.'],
};

function carregarKml(texto, camada) {
  if (/<!DOCTYPE|<!ENTITY/i.test(texto)) throw new Error('O arquivo contém uma declaração não suportada.');
  const xml = new DOMParser().parseFromString(texto, 'application/xml');
  if (xml.documentElement.localName !== 'kml' || xml.querySelector('parsererror')) throw new Error('Selecione um arquivo KML válido.');
  const geometrias = [];
  let quantidade = 0;
  for (const elemento of xml.getElementsByTagNameNS('*', 'coordinates')) {
    const tipo = elemento.parentElement.localName;
    if (!['Point', 'LineString', 'LinearRing'].includes(tipo)) continue;
    const pontos = elemento.textContent.trim().split(/\s+/).map(par => {
      const [lng, lat] = par.split(',');
      if (!lng?.trim() || !lat?.trim() || Math.abs(Number(lng)) > 180 || Math.abs(Number(lat)) > 90) return null;
      return [Number(lat), Number(lng)].every(Number.isFinite) ? [Number(lat), Number(lng)] : null;
    });
    quantidade += pontos.length;
    if (quantidade > 20000) throw new Error('O KML excede o limite de 20 mil coordenadas.');
    if (pontos.some(p => !p)) continue;
    if (tipo === 'Point' && pontos.length === 1) geometrias.push(L.circleMarker(pontos[0], { radius: 6 }));
    if (tipo === 'LineString' && pontos.length >= 2) geometrias.push(L.polyline(pontos));
    if (tipo === 'LinearRing' && elemento.parentElement.parentElement.localName === 'outerBoundaryIs' && pontos.length >= 4) {
      geometrias.push(L.polygon(pontos));
    }
  }
  if (!geometrias.length) throw new Error('O KML não contém pontos, linhas ou contornos compatíveis.');
  geometrias.forEach(item => camada.addLayer(item));
  return L.featureGroup(geometrias).getBounds();
}

export function adicionarFerramentas(mapa, localizacoes, centralizar, camada, veiculos, podePublicar) {
  const barra = L.control({ position: 'topleft' });
  barra.onAdd = () => {
    const caixa = L.DomUtil.create('div', 'mapa-frota-ferramentas');
    L.DomEvent.disableClickPropagation(caixa);
    L.DomEvent.disableScrollPropagation(caixa);
    const botoes = L.DomUtil.create('div', 'leaflet-bar mapa-frota-botoes', caixa);
    const painel = L.DomUtil.create('div', 'mapa-frota-painel', caixa);
    painel.hidden = true;
    const rascunho = L.layerGroup().addTo(mapa);
    let modo = '';
    let pontos = [];
    let botaoAtivo;
    let fecharRota;

    function botao(pai, icone, nome, acao) {
      const item = L.DomUtil.create('button', '', pai);
      item.type = 'button';
      item.title = nome;
      item.setAttribute('aria-label', nome);
      item.textContent = icone;
      item.addEventListener('click', acao);
      return item;
    }

    function abrir(texto) {
      painel.hidden = false;
      const aviso = document.createElement('p');
      aviso.setAttribute('aria-live', 'polite');
      aviso.textContent = texto;
      painel.replaceChildren(aviso);
      return aviso;
    }

    function cancelar() {
      fecharRota?.();
      fecharRota = undefined;
      modo = '';
      pontos = [];
      rascunho.clearLayers();
      botaoAtivo?.setAttribute('aria-pressed', 'false');
      botaoAtivo = null;
      painel.hidden = true;
      mapa.getContainer().classList.remove('mapa-frota-desenhando');
    }

    botao(botoes, '◎', 'Centralizar frota', () => { cancelar(); centralizar(); });
    botao(botoes, 'ⓘ', 'Legenda de status', () => {
      if (!painel.hidden && painel.dataset.tipo === 'legenda') { cancelar(); return; }
      cancelar();
      painel.dataset.tipo = 'legenda';
      abrir('Azul indica posição recente. Vermelho indica última posição conhecida. O contador agrupa veículos no mesmo local.');
    });
    const arquivo = L.DomUtil.create('input', '', caixa);
    arquivo.type = 'file';
    arquivo.accept = '.kml,application/vnd.google-earth.kml+xml';
    arquivo.hidden = true;
    botao(botoes, '↥', 'Importar KML', () => arquivo.click());
    arquivo.addEventListener('change', async () => {
      const selecionado = arquivo.files[0];
      arquivo.value = '';
      if (!selecionado) return;
      cancelar();
      painel.dataset.tipo = 'kml';
      const aviso = abrir('Lendo arquivo KML…');
      try {
        if (selecionado.size > 2 * 1024 * 1024) throw new Error('Escolha um KML de até 2 MB.');
        const conteudo = await selecionado.text();
        if (!caixa.isConnected) return;
        const limites = carregarKml(conteudo, camada);
        if (!mapa.hasLayer(camada)) camada.addTo(mapa);
        mapa.fitBounds(limites, { padding: [48, 48], maxZoom: 16 });
        aviso.textContent = 'KML carregado neste mapa.';
      } catch (erro) {
        aviso.textContent = erro.message;
      }
    });
    botao(botoes, '⌕', 'Buscar veículo', () => {
      if (!painel.hidden && painel.dataset.tipo === 'busca') { cancelar(); return; }
      cancelar();
      painel.dataset.tipo = 'busca';
      abrir(localizacoes.length ? 'Selecione um veículo com posição.' : 'Nenhum veículo com posição disponível.');
      if (!localizacoes.length) return;
      const seletor = L.DomUtil.create('select', '', painel);
      seletor.setAttribute('aria-label', 'Veículo no mapa');
      seletor.add(new Option('Placa ou modelo', ''));
      localizacoes.forEach(({ veiculo }) => seletor.add(new Option([veiculo.placa, veiculo.modelo].filter(Boolean).join(' · '), veiculo.id)));
      seletor.addEventListener('change', () => {
        if (seletor.value === '') return;
        const item = localizacoes.find(({ veiculo }) => String(veiculo.id) === seletor.value);
        if (!item) { cancelar(); return; }
        const { marcador } = item;
        if (!mapa.hasLayer(veiculos)) veiculos.addTo(mapa);
        mapa.setView(marcador.getLatLng(), Math.max(mapa.getZoom(), 15));
        marcador.openPopup();
        cancelar();
      });
      seletor.focus();
    });
    const botaoRota = botao(botoes, '⇢', 'Traçar rota', () => {
      const ativa = Boolean(fecharRota);
      cancelar();
      if (ativa) return;
      painel.dataset.tipo = 'rota';
      painel.hidden = false;
      botaoAtivo = botaoRota;
      botaoRota.setAttribute('aria-pressed', 'true');
      fecharRota = abrirRotaNoMapa(mapa, painel, localizacoes, podePublicar);
    });
    botaoRota.setAttribute('aria-pressed', 'false');
    mapa.once('unload', () => fecharRota?.());

    const desenho = L.DomUtil.create('div', 'leaflet-bar mapa-frota-botoes', caixa);
    const concluir = () => {
      if (modo === 'linha') {
        let metros = 0;
        for (let i = 1; i < pontos.length; i++) metros += mapa.distance(pontos[i - 1], pontos[i]);
        const rotulo = metros >= 1000 ? `${(metros / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} km` : `${Math.round(metros)} m`;
        L.polyline(pontos).bindTooltip(rotulo, { permanent: true, direction: 'center' }).addTo(camada);
      } else if (modo === 'poligono') L.polygon(pontos).addTo(camada);
      else if (modo === 'circulo') L.circle(pontos[0], { radius: mapa.distance(pontos[0], pontos[1]) }).addTo(camada);
      else if (modo === 'ponto') L.circleMarker(pontos[0], { radius: 7 }).addTo(camada);
      if (!mapa.hasLayer(camada)) camada.addTo(mapa);
      cancelar();
    };
    let finalizar;
    for (const [tipo, [icone, nome, instrucoes]] of Object.entries(ferramentas)) {
      const item = botao(desenho, icone, nome, () => {
        const jaAtivo = modo === tipo;
        cancelar();
        if (jaAtivo) return;
        painel.dataset.tipo = 'desenho';
        abrir(instrucoes);
        modo = tipo;
        botaoAtivo = item;
        item.setAttribute('aria-pressed', 'true');
        mapa.getContainer().classList.add('mapa-frota-desenhando');
        if (tipo === 'linha' || tipo === 'poligono') {
          finalizar = botao(painel, 'Concluir', 'Concluir desenho', concluir);
          finalizar.disabled = true;
        }
        botao(painel, 'Cancelar', 'Cancelar desenho', cancelar);
      });
      item.setAttribute('aria-pressed', 'false');
    }
    botao(desenho, '×', 'Limpar desenhos e KML', () => { camada.clearLayers(); cancelar(); });
    mapa.on('click', ({ latlng }) => {
      if (!modo) return;
      pontos.push(latlng);
      if (modo === 'ponto' || (modo === 'circulo' && pontos.length === 2)) { concluir(); return; }
      rascunho.clearLayers();
      if (pontos.length > 1) (modo === 'poligono' ? L.polygon(pontos) : L.polyline(pontos)).addTo(rascunho);
      L.circleMarker(latlng, { radius: 4 }).addTo(rascunho);
      if (modo === 'linha' || modo === 'poligono') finalizar.disabled = pontos.length < (modo === 'linha' ? 2 : 3);
    });
    return caixa;
  };
  barra.addTo(mapa);
}
