import L from 'leaflet';
import api from '../api/api';
import { montarPublicacaoRota } from './publicacaoRota';

const coordenadas = ({ lat, lng }) => ({ latitude: lat, longitude: lng });
const numero = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

function criarPino(mapa, ponto, letra, nome) {
  return L.marker(ponto, {
    draggable: true,
    autoPan: true,
    zIndexOffset: 1000,
    title: nome,
    alt: nome,
    icon: L.divIcon({ className: `mapa-frota-rota-pino mapa-frota-rota-pino-${letra === '+' ? 'passagem' : letra}`,
      html: letra, iconSize: [28, 28], iconAnchor: [14, 14] }),
  }).addTo(mapa);
}

export function abrirRotaNoMapa(mapa, painel, localizacoes, podePublicar) {
  const aviso = document.createElement('p');
  aviso.setAttribute('role', 'status');
  const seletor = document.createElement('select');
  seletor.setAttribute('aria-label', 'Partir da última posição de um veículo');
  seletor.add(new Option('Partir de um veículo', ''));
  localizacoes.forEach(({ veiculo }) => seletor.add(new Option(veiculo.placa, veiculo.id)));
  const alvo = document.createElement('select');
  alvo.setAttribute('aria-label', 'Ponto a marcar no próximo clique');
  alvo.add(new Option('Partida A', 'origem'));
  alvo.add(new Option('Destino B', 'destino'));
  alvo.add(new Option('Nova passagem', 'passagem'));
  const acoes = document.createElement('div');
  acoes.className = 'mapa-frota-rota-acoes';
  const limpar = document.createElement('button');
  limpar.type = 'button';
  limpar.textContent = 'Limpar rota';
  const tentar = document.createElement('button');
  tentar.type = 'button';
  tentar.textContent = 'Tentar novamente';
  const alternar = document.createElement('button');
  alternar.type = 'button';
  const remover = document.createElement('button');
  remover.type = 'button';
  remover.textContent = 'Remover última passagem';
  const abrirNoGoogle = document.createElement('a');
  abrirNoGoogle.target = '_blank';
  abrirNoGoogle.rel = 'noopener noreferrer';
  abrirNoGoogle.textContent = 'Ver rota por ruas no Google Maps';
  acoes.append(limpar, tentar, alternar, remover, abrirNoGoogle);
  painel.replaceChildren(aviso, alvo, ...(localizacoes.length ? [seletor] : []), acoes);
  let origem;
  let destino;
  let destinoDefinido = false;
  const desenho = L.layerGroup().addTo(mapa);
  const passagens = [];
  let personalizada = false;
  let consulta;
  let pontosConfirmados;
  const publicacao = podePublicar ? montarPublicacaoRota(painel, () => pontosConfirmados) : null;

  function invalidarRota() {
    consulta?.abort();
    consulta = undefined;
    desenho.clearLayers();
    tentar.hidden = true;
    abrirNoGoogle.hidden = true;
    pontosConfirmados = undefined;
    publicacao?.mostrar(false);
  }

  function atualizarPassagens() {
    alternar.hidden = !passagens.length;
    remover.hidden = !passagens.length || !personalizada;
    for (const pino of passagens) {
      if (personalizada) pino.addTo(mapa);
      else pino.remove();
    }
    alvo.options[2].disabled = !destinoDefinido || passagens.length >= 3;
    if (alvo.value === 'passagem' && alvo.options[2].disabled) alvo.value = 'destino';
  }

  function resetar() {
    invalidarRota();
    origem?.remove();
    destino?.remove();
    origem = destino = undefined;
    passagens.splice(0).forEach(pino => pino.remove());
    personalizada = false;
    destinoDefinido = false;
    alvo.value = 'origem';
    alvo.options[1].disabled = true;
    atualizarPassagens();
    seletor.value = '';
    limpar.hidden = true;
    aviso.textContent = 'Clique no mapa para marcar a partida ou escolha um veículo com posição GPS.';
  }

  function inserirPassagem(indice, ponto) {
    if (passagens.length >= 3) return;
    const pino = criarPino(mapa, ponto, '+', 'Ponto de passagem. Arraste para mover.');
    pino.on('click', ({ latlng }) => { if (alvo.value !== 'passagem') marcarNoMapa({ latlng }); });
    pino.on('dragstart', invalidarRota);
    pino.on('dragend', calcular);
    passagens.splice(indice, 0, pino);
    personalizada = true;
    atualizarPassagens();
    calcular();
  }

  function desenharTrechos(trechos, porRuas, provedor) {
    const editavel = passagens.length < 3 && (personalizada || !passagens.length);
    trechos.forEach((pontos, indice) => {
      const linha = L.polyline(pontos, {
        color: '#2256b3', weight: 6, dashArray: porRuas ? undefined : '7 8',
        attribution: provedor === 'osrm' ? 'Dados viários © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' : undefined,
        interactive: editavel, bubblingMouseEvents: false,
      }).addTo(desenho);
      if (!editavel) return;
      const selecionarNaLinha = ({ latlng }) => {
        if (alvo.value === 'passagem') inserirPassagem(indice, latlng);
        else marcarNoMapa({ latlng });
      };
      linha.on('click', selecionarNaLinha);
      const meio = pontos.length === 2
        ? L.latLngBounds(pontos).getCenter()
        : pontos[Math.floor(pontos.length / 2)];
      const alca = L.marker(meio, {
        draggable: true, autoPan: true, zIndexOffset: 750,
        title: 'Arraste a linha para definir uma passagem',
        alt: 'Arraste a linha para definir uma passagem',
        icon: L.divIcon({ className: 'mapa-frota-rota-alca', html: '+', iconSize: [19, 19], iconAnchor: [9, 9] }),
      }).addTo(desenho);
      alca.on('click', selecionarNaLinha);
      alca.on('dragend', () => inserirPassagem(indice, alca.getLatLng()));
    });
  }

  async function calcular() {
    invalidarRota();
    const a = mapa.wrapLatLng(origem.getLatLng());
    const b = mapa.wrapLatLng(destino.getLatLng());
    if (mapa.distance(a, b) < 1) {
      aviso.textContent = 'Afaste o destino da partida para calcular a rota.';
      return;
    }
    const atual = new AbortController();
    const pontosPassagem = personalizada ? passagens.map(p => mapa.wrapLatLng(p.getLatLng())) : [];
    const vias = pontosPassagem.map(coordenadas);
    consulta = atual;
    aviso.textContent = 'Calculando a rota…';
    try {
      const { data: { dados } } = await api.post('/painel/rota', {
        origem: coordenadas(a), destino: coordenadas(b), passagens: vias,
      }, { signal: atual.signal });
      if (consulta !== atual) return;
      const pontos = [a, ...pontosPassagem, b];
      const trechos = dados.porRuas
        ? dados.trechos.map(trecho => trecho.map(([lng, lat]) => [lat, lng]))
        : pontos.slice(1).map((ponto, indice) => [pontos[indice], ponto]);
      desenharTrechos(trechos, dados.porRuas, dados.provedor);
      const distancia = `${numero.format(dados.distanciaKm)} km`;
      const tipo = personalizada ? 'Personalizada' : 'Recomendada por tempo';
      const dica = passagens.length < 3 ? ' Clique no mapa para acrescentar uma passagem ou escolha A ou B no seletor.' : '';
      aviso.textContent = dados.porRuas
        ? `${tipo} · ${distancia} · ${Math.max(1, Math.round(dados.duracaoSegundos / 60))} min estimados.${dica}`
        : `${personalizada ? 'Personalizada' : 'Direta'} · ${distancia} em linha reta. Roteador viário não configurado.${dica}`;
      alternar.textContent = personalizada
        ? dados.porRuas ? 'Ver rota recomendada' : 'Ver linha direta'
        : 'Voltar à rota personalizada';
      if (!dados.porRuas) {
        const params = new URLSearchParams({ api: '1', origin: `${a.lat},${a.lng}`, destination: `${b.lat},${b.lng}`, travelmode: 'driving' });
        if (pontosPassagem.length) params.set('waypoints', pontosPassagem.map(ponto => `${ponto.lat},${ponto.lng}`).join('|'));
        abrirNoGoogle.href = `https://www.google.com/maps/dir/?${params}`;
        abrirNoGoogle.hidden = false;
      }
      pontosConfirmados = { origem: coordenadas(a), destino: coordenadas(b), passagens: vias };
      publicacao?.mostrar(true);
    } catch (erro) {
      if (consulta !== atual) return;
      const resposta = erro.response?.data;
      aviso.textContent = resposta?.mensagem || 'Não foi possível calcular a rota.';
      if (resposta?.ponto === 'origem' || resposta?.ponto === 'destino') alvo.value = resposta.ponto;
      tentar.hidden = false;
    } finally {
      if (consulta === atual) consulta = undefined;
    }
  }

  function marcarOrigem(ponto) {
    resetar();
    const pixel = mapa.latLngToContainerPoint(ponto);
    const lado = pixel.x + 46 > mapa.getSize().x ? -46 : 46;
    const sugestao = mapa.containerPointToLatLng(pixel.add([lado, 0]));
    origem = criarPino(mapa, ponto, 'A', 'Partida da rota. Arraste para mover.');
    destino = criarPino(mapa, sugestao, 'B', 'Destino da rota. Clique para confirmar ou arraste para mover.');
    origem.on('dragstart', invalidarRota);
    destino.on('dragstart', invalidarRota);
    origem.on('dragend', () => {
      seletor.value = '';
      if (destinoDefinido) calcular();
    });
    destino.on('dragend', confirmarDestino);
    destino.on('click', () => { if (!destinoDefinido) confirmarDestino(); });
    alvo.options[1].disabled = false;
    alvo.value = 'destino';
    limpar.hidden = false;
    aviso.textContent = 'Partida A marcada. Clique no mapa para marcar o destino B ou arraste o marcador B.';
  }

  function confirmarDestino() {
    destinoDefinido = true;
    atualizarPassagens();
    alvo.value = passagens.length < 3 ? 'passagem' : 'destino';
    calcular();
  }

  function marcarNoMapa({ latlng }) {
    if (!origem) {
      marcarOrigem(latlng);
    } else if (alvo.value === 'origem') {
      origem.setLatLng(latlng);
      seletor.value = '';
      if (destinoDefinido) {
        alvo.value = passagens.length < 3 ? 'passagem' : 'destino';
        calcular();
      } else alvo.value = 'destino';
    } else if (alvo.value === 'destino') {
      destino.setLatLng(latlng);
      confirmarDestino();
    } else inserirPassagem(passagens.length, latlng);
  }

  seletor.addEventListener('change', () => {
    if (seletor.value === '') return;
    const id = seletor.value;
    const posicao = localizacoes.find(({ veiculo }) => String(veiculo.id) === id)?.veiculo.posicao;
    if (!posicao) return;
    const ponto = L.latLng(posicao.latitude, posicao.longitude);
    mapa.setView(ponto, Math.max(13, mapa.getZoom()), { animate: false });
    marcarOrigem(ponto);
    seletor.value = id;
  });
  limpar.addEventListener('click', resetar);
  tentar.addEventListener('click', calcular);
  alternar.addEventListener('click', () => {
    personalizada = !personalizada;
    atualizarPassagens();
    calcular();
  });
  remover.addEventListener('click', () => {
    passagens.pop()?.remove();
    personalizada = passagens.length > 0;
    atualizarPassagens();
    alvo.value = 'passagem';
    calcular();
  });
  mapa.on('click', marcarNoMapa);
  mapa.closePopup();
  resetar();

  return () => {
    mapa.off('click', marcarNoMapa);
    publicacao?.fechar();
    resetar();
    desenho.remove();
  };
}
