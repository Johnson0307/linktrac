import { useState } from 'react';
import api from '../api/api';
import CoordenadasEntrega, { ponto } from './CoordenadasEntrega';

export const nomesMovimentos = {
  recolher_cheio: 'Recolher cheio',
  recolher_vazio: 'Recolher vazio',
  deixar_cheio: 'Deixar cheio',
  deixar_vazio: 'Deixar vazio',
  descarregar: 'Descarregar e manter o vazio a bordo',
};

export function ResumoMovimentos({ movimentos, carga, realizado = false }) {
  if (!movimentos?.length) return null;
  const aBordo = (carga || []).map(item => item.numero + ' (' + item.estado + ')');
  return <div>
    <ul>{movimentos.map((item, i) => <li key={i}>{nomesMovimentos[item.tipo]} · {item.numero}</li>)}</ul>
    <small>Carga {realizado ? 'realizada' : 'prevista'} após a parada: {aBordo.length ? aBordo.join(', ') : 'nenhum contêiner'}.</small>
  </div>;
}

export const gerarId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
const novaParada = () => ({ id: gerarId(), movimentos: [{ tipo: 'recolher_cheio', numero: '' }] });
const horaIso = valor => valor ? new Date(valor).toISOString() : undefined;

export function Linhas({ lista, alterar, inicial = false }) {
  const campo = inicial ? 'estado' : 'tipo';
  const opcoes = inicial ? { cheio: 'Cheio', vazio: 'Vazio' } : nomesMovimentos;
  const limite = inicial ? 12 : 36;
  return <>
    {lista.map((item, i) => <div className="central-form" key={i}>
      <label>Número do contêiner
        <input required maxLength={50} value={item.numero}
          onChange={e => alterar(lista.map((v, j) => j === i ? { ...v, numero: e.target.value } : v))} />
      </label>
      <label>{inicial ? 'Estado inicial' : 'Movimentação'}
        <select value={item[campo]} onChange={e => alterar(lista.map((v, j) => j === i ? { ...v, [campo]: e.target.value } : v))}>
          {Object.entries(opcoes).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </select>
      </label>
      <button type="button" disabled={!inicial && lista.length === 1} onClick={() => alterar(lista.filter((_, j) => i !== j))}>Remover</button>
    </div>)}
    <button type="button" disabled={lista.length >= limite} onClick={() => alterar([
      ...lista, { numero: '', [campo]: inicial ? 'vazio' : 'recolher_cheio' },
    ])}>{inicial ? 'Adicionar contêiner a bordo' : 'Adicionar movimentação'}</button>
  </>;
}

export default function RotaTrocasConteiner({ veiculoId, opcoes, aoSalvar, cancelar }) {
  const [viagemId] = useState(gerarId);
  const [numero, setNumero] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [capacidade, setCapacidade] = useState(1);
  const [cargaInicial, setCargaInicial] = useState([]);
  const [etapas, setEtapas] = useState(() => [novaParada()]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  function alterar(id, campos) {
    setEtapas(atuais => atuais.map(etapa => etapa.id === id ? { ...etapa, ...campos } : etapa));
  }

  function mover(i, deslocamento) {
    setEtapas(atuais => {
      const ordem = [...atuais];
      [ordem[i], ordem[i + deslocamento]] = [ordem[i + deslocamento], ordem[i]];
      return ordem;
    });
  }

  async function salvar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      const dados = etapas.map((etapa, i) => {
        const local = ponto(etapa);
        if (!local && [etapa.latitude, etapa.longitude].some(v => v !== undefined && v !== '')) {
          throw new Error('Parada ' + (i + 1) + ': preencha as duas coordenadas ou deixe ambas em branco.');
        }
        return {
          destinatario: etapa.destinatario, endereco: etapa.endereco, ...local, movimentos: etapa.movimentos,
          janelaInicio: horaIso(etapa.janelaInicio), janelaFim: horaIso(etapa.janelaFim),
          minutosServico: etapa.minutosServico === undefined || etapa.minutosServico === '' ? 10 : Number(etapa.minutosServico),
        };
      });
      const { data } = await api.post('/tms/conteineres', {
        modo: 'trocas', viagemId, veiculoId, motoristaId: motoristaId || undefined,
        numero, capacidade: Number(capacidade), cargaInicial, etapas: dados,
      });
      aoSalvar(data.dados);
    } catch (err) {
      setErro(err.response?.data?.mensagem || err.message || 'Não foi possível salvar a rota com trocas.');
    } finally {
      setOcupado(false);
    }
  }

  return <form className="central-card" onSubmit={salvar}>
    <h3>Nova rota com trocas de contêiner</h3>
    {erro && <p role="alert">{erro}</p>}
    <fieldset className="central-form" disabled={ocupado}>
      <label>Referência da rota
        <input required value={numero} maxLength={50} onChange={e => setNumero(e.target.value)} />
      </label>
      <label>Motorista
        <select value={motoristaId} onChange={e => setMotoristaId(e.target.value)}>
          <option value="">Sem atribuição</option>
          {opcoes.motoristas.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
        </select>
      </label>
      <label>Capacidade a bordo
        <input type="number" min="1" max="12" step="1" required value={capacidade} onChange={e => setCapacidade(e.target.value)} />
      </label>
      <fieldset className="central-full">
        <legend>Contêineres a bordo na partida</legend>
        {!cargaInicial.length && <p>O veículo parte vazio.</p>}
        <Linhas inicial lista={cargaInicial} alterar={setCargaInicial} />
      </fieldset>
      <p className="central-full">Informe as paradas e as movimentações na ordem da operação. Se o veículo estiver lotado, registre a saída antes da próxima coleta.</p>
      {etapas.map((etapa, i) => {
        const campo = (chave, label, props = {}) => <label>{label}
          <input {...props} value={etapa[chave] ?? ''} onChange={e => alterar(etapa.id, { [chave]: e.target.value })} />
        </label>;
        return <fieldset className="central-form central-full" key={etapa.id}>
          <legend>Parada {i + 1}</legend>
          {campo('destinatario', 'Cliente, terminal ou ponto de descarga', { required: true, maxLength: 300 })}
          {campo('endereco', 'Endereço da parada', { required: true, maxLength: 300 })}
          <CoordenadasEntrega valor={etapa} alterar={dados => alterar(etapa.id, dados)}
            endereco={etapa.endereco} podeLocalizar={opcoes.geocodificador} />
          {campo('janelaInicio', 'Início da janela', { type: 'datetime-local' })}
          {campo('janelaFim', 'Fim da janela', { type: 'datetime-local' })}
          {campo('minutosServico', 'Minutos de atendimento', { type: 'number', min: 0, max: 480 })}
          <div className="central-full">
            <h4>Movimentações</h4>
            <Linhas lista={etapa.movimentos} alterar={movimentos => alterar(etapa.id, { movimentos })} />
          </div>
          <div className="central-full">
            <button type="button" disabled={i === 0} onClick={() => mover(i, -1)}>Subir parada</button>{' '}
            <button type="button" disabled={i === etapas.length - 1} onClick={() => mover(i, 1)}>Descer parada</button>{' '}
            <button type="button" disabled={etapas.length === 1}
              onClick={() => setEtapas(atuais => atuais.filter(v => v.id !== etapa.id))}>Remover parada</button>
          </div>
        </fieldset>;
      })}
      <div className="central-full">
        <button type="button" disabled={etapas.length >= 50} onClick={() => setEtapas(atuais => [...atuais, novaParada()])}>Adicionar parada</button>{' '}
        <button type="submit">{ocupado ? 'Salvando...' : 'Salvar rota com trocas'}</button>{' '}
        <button type="button" onClick={cancelar}>Cancelar</button>
      </div>
    </fieldset>
  </form>;
}
