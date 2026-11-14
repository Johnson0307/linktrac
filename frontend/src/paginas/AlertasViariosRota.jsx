import { useEffect, useRef, useState } from 'react';
import api from '../api/api';

const intervalo = 4000;
const intervaloSom = 180000;

function emitirSom(contexto) {
  if (contexto?.state !== 'running') return;
  const tom = contexto.createOscillator();
  const volume = contexto.createGain();
  tom.frequency.value = 740;
  volume.gain.value = 0.12;
  tom.connect(volume).connect(contexto.destination);
  tom.start();
  tom.stop(contexto.currentTime + 0.25);
}

export default function AlertasViariosRota({ rotaId }) {
  const [ativo, setAtivo] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [estado, setEstado] = useState('');
  const [som, setSom] = useState(false);
  const audio = useRef(null);
  const ultimosSons = useRef(new Map());

  useEffect(() => () => { audio.current?.close().catch(() => {}); }, []);

  useEffect(() => {
    if (!ativo) return;
    let consulta;
    let timer;
    let encerrado = false;
    const pararConsulta = () => {
      clearTimeout(timer);
      consulta?.abort();
    };

    async function atualizar() {
      if (encerrado || document.hidden) return;
      const controle = new AbortController();
      consulta = controle;
      try {
        const { data } = await api.get(`/tms/rotas-mapa/${encodeURIComponent(rotaId)}/alerta-viario`,
          { signal: controle.signal, timeout: 6000 });
        if (controle.signal.aborted) return;
        setResultado(data.dados);
        setEstado(data.disponivel ? (data.gpsRecente ? 'Monitorando a posição do veículo.' : 'Aguardando posições recentes do rastreador.') : 'Base viária indisponível.');
        const radar = data.dados?.id;
        const agora = Date.now();
        if (radar && audio.current?.state === 'running' && agora - (ultimosSons.current.get(radar) || 0) >= intervaloSom) {
          ultimosSons.current.set(radar, agora);
          emitirSom(audio.current);
        }
      } catch (erro) {
        if (controle.signal.aborted) return;
        setResultado(null);
        if ([401, 403, 404].includes(erro.response?.status)) {
          setEstado('A rota deixou de estar disponível para avisos.');
          setAtivo(false);
          return;
        }
        setEstado('Conexão indisponível. Tentando novamente.');
      }
      if (!controle.signal.aborted && !document.hidden) timer = setTimeout(atualizar, intervalo);
    }

    const aoMudarVisibilidade = () => {
      pararConsulta();
      if (document.hidden) setResultado(null);
      else atualizar();
    };
    document.addEventListener('visibilitychange', aoMudarVisibilidade);
    atualizar();
    return () => {
      encerrado = true;
      pararConsulta();
      document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    };
  }, [ativo, rotaId]);

  async function alternarSom() {
    try {
      if (som) {
        await audio.current.suspend();
        setSom(false);
        return;
      }
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error();
      audio.current ??= new Audio();
      await audio.current.resume();
      setSom(true);
    } catch {
      setSom(false);
      setEstado('Som indisponível neste navegador. Os avisos visuais continuam.');
    }
  }

  return <section aria-label="Avisos de fiscalização">
    <h3>Avisos de fiscalização</h3>
    <p>Use com a rota aberta na tela. Os avisos dependem das posições recentes do veículo e da cobertura da via.</p>
    <button type="button" onClick={() => {
      setResultado(null);
      setEstado(ativo ? '' : 'Verificando a posição do veículo…');
      setAtivo(!ativo);
    }}>{ativo ? 'Desativar avisos' : 'Ativar avisos'}</button>
    {ativo && <button type="button" onClick={alternarSom} aria-pressed={som}>{som ? 'Silenciar avisos' : 'Ativar som'}</button>}
    {estado && !resultado && <p role="status">{estado}</p>}
    {ativo && resultado && <div role="status">
      <strong>Fiscalização à frente</strong>
      <p>{resultado.nome} · cerca de {resultado.metros} m
        {resultado.limite != null && ` · limite publicado ${resultado.limite} km/h`}</p>
      <small>{resultado.fonte} · Confira a sinalização.</small>
    </div>}
  </section>;
}
