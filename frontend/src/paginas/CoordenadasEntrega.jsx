import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import api from '../api/api';
import { adicionarControleCamadas, criarCamadasMapa } from '../componentes/camadasMapa';

export function ponto(coordenadas) {
  const { latitude, longitude } = coordenadas;
  if (latitude === '' || longitude === '' || latitude == null || longitude == null) return undefined;
  const lat = Number(latitude);
  const lon = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return undefined;
  return { latitude: lat, longitude: lon };
}

export default function CoordenadasEntrega({ valor, alterar, endereco, podeLocalizar, tipoPonto = 'da entrega' }) {
  const [opcoes, setOpcoes] = useState([]);
  const [consultado, setConsultado] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [mapa, setMapa] = useState(false);

  async function buscar() {
    setOcupado(true);
    setMensagem('');
    setOpcoes([]);
    setConsultado(endereco);
    try {
      const { data } = await api.post('/tms/localizar', { endereco });
      setOpcoes(data.dados);
      if (!data.dados.length) setMensagem('Nenhum local encontrado. Confira o endereço ou informe as coordenadas.');
    } catch (e) {
      setMensagem(e.response?.data?.mensagem || 'Não foi possível buscar o endereço.');
    } finally {
      setOcupado(false);
    }
  }

  return <>
    <label>Latitude
      <input type="number" min="-90" max="90" step="any" value={valor.latitude ?? ''}
        onChange={e => alterar({ latitude: e.target.value })} />
    </label>
    <label>Longitude
      <input type="number" min="-180" max="180" step="any" value={valor.longitude ?? ''}
        onChange={e => alterar({ longitude: e.target.value })} />
    </label>
    <div className="central-full">
      <button type="button" onClick={() => setMapa(v => !v)}>{mapa ? 'Fechar mapa' : 'Escolher ponto no mapa'}</button>
      {mapa && <SeletorMapa inicial={ponto(valor)} tipoPonto={tipoPonto} escolher={local => { alterar(local); setMapa(false); }} />}
    </div>
    {podeLocalizar && <div className="central-full">
      <button type="button" disabled={ocupado || !endereco?.trim()} onClick={buscar}>
        {ocupado ? 'Buscando...' : 'Buscar coordenadas pelo endereço'}
      </button>
      {mensagem && consultado === endereco && <p role="status">{mensagem}</p>}
      {consultado === endereco && opcoes.length > 0 && <ul>{opcoes.map((local, index) =>
        <li key={index}><button type="button" onClick={() => {
          alterar({ latitude: local.latitude, longitude: local.longitude });
          setOpcoes([]);
        }}>{local.endereco}</button></li>
      )}</ul>}
    </div>}
  </>;
}

function SeletorMapa({ inicial, escolher, tipoPonto }) {
  const container = useRef(null);
  const inicio = useRef(inicial);
  const selecionar = useRef(escolher);
  useEffect(() => { selecionar.current = escolher; }, [escolher]);
  useEffect(() => {
    const local = inicio.current;
    const mapa = L.map(container.current).setView(local ? [local.latitude, local.longitude] : [-15.8, -47.9], local ? 15 : tipoPonto === 'da entrega' ? 4 : 11);
    const { fundos, sobreposicoes } = criarCamadasMapa();
    fundos.Ruas.addTo(mapa);
    adicionarControleCamadas(mapa, fundos, sobreposicoes);
    mapa.on('click', ({ latlng }) => selecionar.current({ latitude: latlng.lat, longitude: latlng.lng }));
    return () => mapa.remove();
  }, [tipoPonto]);
  return <>
    <p>Amplie o mapa e toque no ponto {tipoPonto}. Você também pode informar as coordenadas pelos campos acima.</p>
    <div ref={container} role="region" aria-label="Mapa para escolher coordenadas" style={{ height: 300, zIndex: 0 }} />
  </>;
}
