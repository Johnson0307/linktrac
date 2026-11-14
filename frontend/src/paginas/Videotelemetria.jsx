import { lazy, Suspense, useEffect, useState } from 'react';
import api from '../api/api';

const CatalogoRastreadores = lazy(() => import('./CatalogoRastreadores'));

const rotulos = {
  fadiga: 'Fadiga', distracao: 'Distração', celular: 'Uso de celular', cinto: 'Cinto',
  colisao: 'Colisão', sos: 'SOS', frenagem: 'Frenagem', manual: 'Gravação manual', outro: 'Outro',
};

export default function Videotelemetria({ veiculos }) {
  const [veiculoId, setVeiculoId] = useState('');
  return <section className="central-card">
    <h3>Eventos e clipes por veículo</h3>
    <p>Cadastre a câmera ou o gravador em Equipamentos e credenciais. O fornecedor ou integrador envia os eventos e os links dos clipes.</p>
    <Suspense fallback={<p>Carregando catálogo de câmeras...</p>}>
      <CatalogoRastreadores somenteCameras />
    </Suspense>
    <label>Veículo
      <select value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
        <option value="">Todos os veículos</option>
        {veiculos.map(v => <option key={v._id} value={v._id}>{v.placa} — {v.marca} {v.modelo}</option>)}
      </select>
    </label>
    <Eventos key={veiculoId} veiculoId={veiculoId} />
  </section>;
}

function Eventos({ veiculoId }) {
  const [eventos, setEventos] = useState([]);
  const [proximo, setProximo] = useState(null);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(true);

  useEffect(() => {
    let ativo = true;
    api.get('/operacao/video-eventos', { params: { veiculoId: veiculoId || undefined } })
      .then(({ data }) => {
        if (ativo) {
          setEventos(data.dados);
          setProximo(data.proximo);
        }
      })
      .catch(() => { if (ativo) setErro('Não foi possível carregar os eventos de vídeo.'); })
      .finally(() => { if (ativo) setOcupado(false); });
    return () => { ativo = false; };
  }, [veiculoId]);

  async function carregarMais() {
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.get('/operacao/video-eventos', {
        params: { ...proximo, veiculoId: veiculoId || undefined },
      });
      setEventos(lista => [...lista, ...data.dados]);
      setProximo(data.proximo);
    } catch {
      setErro('Não foi possível carregar mais eventos.');
    } finally {
      setOcupado(false);
    }
  }

  return <div className="central-scroll">
    {erro && <p role="alert">{erro}</p>}
    {ocupado && <p>Carregando eventos...</p>}
    {!eventos.length && !ocupado && !erro && <p>Nenhum evento de vídeo recebido.</p>}
    {!!eventos.length && <table>
      <thead><tr><th>Data e hora</th><th>Veículo</th><th>Equipamento</th><th>Canal</th><th>Evento</th><th>Vídeo</th></tr></thead>
      <tbody>{eventos.map(evento => <tr key={evento._id}>
        <td>{new Date(evento.dataHora).toLocaleString('pt-BR')}</td>
        <td>{evento.placa}</td><td>{evento.equipamento}</td><td>{evento.canal}</td>
        <td>{rotulos[evento.tipo] || evento.tipo}</td>
        <td>{!evento.clipeUrl ? 'Sem clipe' :
          evento.clipeExpiraEm && Date.parse(evento.clipeExpiraEm) <= Date.now() ? 'Link expirado' :
          <a href={evento.clipeUrl} target="_blank" rel="noopener noreferrer">Abrir clipe</a>}</td>
      </tr>)}</tbody>
    </table>}
    {proximo && <button type="button" disabled={ocupado} onClick={carregarMais}>Carregar mais</button>}
  </div>;
}
