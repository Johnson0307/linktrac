import { useEffect, useMemo, useState } from 'react';
import MapaTrajeto from './MapaTrajeto';

const intervaloComLacuna = 5 * 60000;
const velocidades = [15, 60, 120, 240];
const milissegundos = ponto => +new Date(ponto.dataHora);
const horario = ponto => new Date(ponto.dataHora).toLocaleString('pt-BR');

function pontosDoReplay(posicoes) {
  return posicoes.filter(p => p.dataHora && Number.isFinite(milissegundos(p)) &&
    Number.isFinite(p.latitude) && Math.abs(p.latitude) <= 90 &&
    Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180 && p.status !== 'Sem sinal')
    .sort((a, b) => milissegundos(a) - milissegundos(b));
}

export default function ReplayTrajeto({ posicoes, cercas }) {
  const pontos = useMemo(() => pontosDoReplay(posicoes), [posicoes]);
  const [aberto, setAberto] = useState(false);
  const [reproduzindo, setReproduzindo] = useState(false);
  const [indice, setIndice] = useState(0);
  const [velocidade, setVelocidade] = useState(60);
  const ultimo = pontos.length - 1;
  const ponto = pontos[indice];
  const anterior = pontos[indice - 1];
  const lacuna = anterior && ponto && milissegundos(ponto) - milissegundos(anterior) > intervaloComLacuna;

  useEffect(() => {
    if (!reproduzindo || indice >= ultimo) return;
    const intervalo = milissegundos(pontos[indice + 1]) - milissegundos(pontos[indice]);
    const espera = intervalo > intervaloComLacuna ? 800 : Math.max(80, intervalo / velocidade);
    const timer = setTimeout(() => {
      setIndice(indice + 1);
      if (indice + 1 === ultimo) setReproduzindo(false);
    }, espera);
    return () => clearTimeout(timer);
  }, [indice, ultimo, pontos, reproduzindo, velocidade]);

  function irPara(posicao) {
    setReproduzindo(false);
    setIndice(posicao);
  }

  return <>
    {pontos.length > 1 && <button type="button" aria-expanded={aberto} onClick={() => {
      setReproduzindo(false);
      setAberto(valor => !valor);
    }}>{aberto ? 'Fechar replay' : 'Replay do trajeto'}</button>}
    {aberto && ponto && <section aria-label="Controles do replay" style={{ margin: '0.75rem 0' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '0.5rem' }}>
        <button type="button" onClick={() => irPara(0)}>Voltar ao início</button>
        <button type="button" disabled={indice === 0} onClick={() => irPara(indice - 1)}>Ponto anterior</button>
        <button type="button" onClick={() => {
          if (reproduzindo) return setReproduzindo(false);
          if (indice === ultimo) setIndice(0);
          setReproduzindo(true);
        }}>{reproduzindo ? 'Pausar' : 'Reproduzir'}</button>
        <button type="button" disabled={indice === ultimo} onClick={() => irPara(indice + 1)}>Próximo ponto</button>
        <label>Velocidade do replay <select value={velocidade} onChange={e => setVelocidade(Number(e.target.value))}>
          {velocidades.map(v => <option key={v} value={v}>{v}×</option>)}
        </select></label>
      </div>
      <label style={{ display: 'block', marginTop: '0.5rem' }}>Posição no trajeto
        <input type="range" min={0} max={ultimo} step={1} value={indice} style={{ display: 'block', width: '100%' }}
          aria-valuetext={horario(ponto)} onChange={e => irPara(Number(e.target.value))} />
      </label>
      <p aria-live={reproduzindo ? 'off' : 'polite'}>
        {horario(ponto)} · Ponto {indice + 1} de {pontos.length}
        {Number.isFinite(ponto.velocidade) && ` · ${ponto.velocidade} km/h`}
      </p>
      {lacuna && <p>Mais de 5 minutos sem posição válida registrada antes deste ponto.</p>}
    </section>}
    <MapaTrajeto posicoes={posicoes} cercas={cercas} posicaoReplay={aberto ? ponto : null} />
  </>;
}
