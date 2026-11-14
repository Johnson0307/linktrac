import { useState } from 'react';
import api from '../api/api';
import MapaTrajeto from '../componentes/MapaTrajeto';
import CoordenadasEntrega, { ponto } from './CoordenadasEntrega';
import { ResumoMovimentos } from './RotaTrocasConteiner';
import { nomesEtapaConteiner, acoesEtapaConteiner } from './ViagemConteiner';

const agoraLocal = () => {
  const agora = new Date();
  return new Date(agora.getTime() - agora.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

export default function RotaEntregas({ veiculoId, selecionados, paradas, provedores, aoConcluir, atualizando }) {
  const [origem, setOrigem] = useState({ latitude: '', longitude: '' });
  const [enderecoOrigem, setEnderecoOrigem] = useState('');
  const [partida, setPartida] = useState(agoraLocal);
  const [retornar, setRetornar] = useState(false);
  const [velocidadeMedia, setVelocidadeMedia] = useState(35);
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const escolhidas = paradas.filter(p => selecionados.includes(p._id));
  const faltantes = escolhidas.filter(p => !ponto(p.dados)).length;
  const assinatura = JSON.stringify([veiculoId, escolhidas.map(p => [p._id, p.dados.latitude, p.dados.longitude,
    p.dados.janelaInicio, p.dados.janelaFim, p.dados.minutosServico]), origem, partida, retornar, velocidadeMedia]);
  const rota = resultado?.dados;

  async function calcular(e) {
    e.preventDefault();
    if (!ponto(origem) || faltantes || !escolhidas.length) return;
    setOcupado(true);
    setErro('');
    setResultado(null);
    try {
      const { data } = await api.post('/tms/rota', {
        veiculoId, paradas: escolhidas.map(p => p._id), origem: ponto(origem),
        partida: new Date(partida).toISOString(), retornar, velocidadeMedia: Number(velocidadeMedia),
      });
      setResultado({ assinatura, dados: data.dados, partida });
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível calcular a rota.');
    } finally {
      setOcupado(false);
    }
  }

  function usarLocalizacao() {
    setErro('');
    if (!navigator.geolocation) {
      setErro('Localização indisponível. Informe as coordenadas da partida.');
      return;
    }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setOrigem({ latitude: coords.latitude, longitude: coords.longitude });
    }, () => setErro('Não foi possível obter sua localização. Confira a permissão ou informe as coordenadas.'), { timeout: 10000 });
  }

  const posicoes = rota && [
    { ...rota.origem, dataHora: new Date(resultado.partida).toISOString(), legenda: 'Partida' },
    ...rota.etapas.map((p, i) => ({ ...p, dataHora: p.chegadaEstimada, legenda: `${i + 1}. ${p.destinatario}` })),
    ...(rota.retornar ? [{ ...rota.origem, dataHora: rota.terminoEstimado, legenda: 'Retorno à origem' }] : []),
  ];

  return <section className="central-card">
    <h3>Planejar rota</h3>
    <p>{escolhidas.length} paradas selecionadas. {faltantes > 0 && `${faltantes} sem localização confirmada.`}</p>
    <p>{provedores.roteador
      ? 'O roteiro usa tempos e distâncias por ruas do provedor configurado.'
      : 'Estimativa em linha reta. Configure um roteador para usar distâncias por ruas.'}</p>
    <form onSubmit={calcular}>
      <fieldset className="central-form" disabled={ocupado}>
        <legend>Ponto e horário de partida</legend>
        {provedores.geocodificador && <label className="central-full">Endereço de partida
          <input value={enderecoOrigem} maxLength={300} onChange={e => setEnderecoOrigem(e.target.value)} />
        </label>}
        <CoordenadasEntrega valor={origem} alterar={dados => setOrigem(v => ({ ...v, ...dados }))}
          endereco={enderecoOrigem} podeLocalizar={provedores.geocodificador} />
        <button type="button" onClick={usarLocalizacao}>Usar minha localização como partida</button>
        <label>Saída <input type="datetime-local" required value={partida} onChange={e => setPartida(e.target.value)} /></label>
        {!provedores.roteador && <label>Velocidade média estimada (km/h)
          <input type="number" min="5" max="120" required value={velocidadeMedia} onChange={e => setVelocidadeMedia(e.target.value)} />
        </label>}
        <label className="central-checkbox">
          <input type="checkbox" checked={retornar} onChange={e => setRetornar(e.target.checked)} /> Retornar à origem
        </label>
        <button type="submit" disabled={!ponto(origem) || !escolhidas.length || escolhidas.length > 50 || faltantes > 0}>
          {ocupado ? 'Calculando...' : 'Calcular rota'}
        </button>
      </fieldset>
    </form>
    {erro && <p role="alert">{erro}</p>}
    {rota && <>
      <h4>Ordem sugerida de entregas</h4>
      {resultado.assinatura !== assinatura && <p>O roteiro abaixo foi calculado antes das mudanças. Recalcule para atualizar as estimativas.</p>}
      <p>{rota.distanciaKm.toFixed(1)} km · Término previsto {new Date(rota.terminoEstimado).toLocaleString('pt-BR')}
        {rota.janelasExcedidas > 0 && ` · ${rota.janelasExcedidas} fora da janela`}.</p>
      <MapaTrajeto posicoes={posicoes} geometria={rota.geometria} modo="rota" />
      <ol>{rota.etapas.map(p => <li key={p.id}>
        <strong>{p.destinatario}</strong> — {p.endereco}<br />
        {p.etapaConteiner && <>{nomesEtapaConteiner[p.etapaConteiner]} · {p.referenciaCarga}<br /></>}
        <ResumoMovimentos movimentos={p.movimentosConteiner} carga={p.cargaAposEtapa} />
        Atendimento às {new Date(p.inicioAtendimento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
        {p.janelaExcedida && ' · Fora da janela'}<br />
        <a href={`https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`}
          target="_blank" rel="noopener noreferrer">Navegar até a parada</a>{' '}
        {paradas.find(item => item._id === p.id)?.dados.status === 'entregue'
          ? <strong>Concluída</strong>
          : aoConcluir && <button type="button" disabled={atualizando} onClick={() => aoConcluir(p.id)}>{acoesEtapaConteiner[p.etapaConteiner] || 'Concluir entrega'}</button>}
      </li>)}</ol>
    </>}
  </section>;
}
