import { useEffect, useState } from 'react';
import api from '../api/api';
import CoordenadasEntrega, { ponto } from './CoordenadasEntrega';
import { ResumoMovimentos } from './RotaTrocasConteiner';

export const nomesEtapaConteiner = {
  retirada: 'Retirada no terminal',
  entrega: 'Entrega do contêiner',
  devolucao: 'Devolução do vazio',
  troca: 'Movimentação de contêiner',
};
export const acoesEtapaConteiner = {
  retirada: 'Concluir retirada',
  entrega: 'Concluir entrega',
  devolucao: 'Concluir devolução',
  troca: 'Concluir parada',
};

const gerarId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), n => n.toString(16).padStart(2, '0')).join('');
const horaIso = valor => valor ? new Date(valor).toISOString() : undefined;

export default function ViagemConteiner({ veiculoId, opcoes, aoSalvar, cancelar }) {
  const [viagemId] = useState(gerarId);
  const [numero, setNumero] = useState('');
  const [motoristaId, setMotoristaId] = useState('');
  const [etapas, setEtapas] = useState(() => [{}, {}, {}]);
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);

  const alterar = (index, campos) => {
    setEtapas(atuais => atuais.map((etapa, i) => i === index ? { ...etapa, ...campos } : etapa));
  };

  async function salvar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    try {
      const dados = etapas.map(etapa => {
        const local = ponto(etapa);
        if (!local && [etapa.latitude, etapa.longitude].some(v => v !== undefined && v !== '')) {
          throw new Error('Informe as duas coordenadas ou deixe as duas em branco para localizar depois.');
        }
        return {
          destinatario: etapa.destinatario, endereco: etapa.endereco, ...local,
          janelaInicio: horaIso(etapa.janelaInicio), janelaFim: horaIso(etapa.janelaFim),
          minutosServico: etapa.minutosServico === undefined || etapa.minutosServico === '' ? 10 : Number(etapa.minutosServico),
        };
      });
      const { data } = await api.post('/tms/conteineres', {
        viagemId, veiculoId, motoristaId: motoristaId || undefined, numero, etapas: dados,
      });
      aoSalvar(data.dados);
    } catch (err) {
      setErro(err.response?.data?.mensagem || err.message || 'Não foi possível salvar a viagem.');
    } finally {
      setOcupado(false);
    }
  }

  return <form className="central-card" onSubmit={salvar}>
    <h3>Nova viagem de contêiner</h3>
    {erro && <p role="alert">{erro}</p>}
    <fieldset className="central-form" disabled={ocupado}>
      <label>Número ou referência do contêiner
        <input required value={numero} maxLength={50} onChange={e => setNumero(e.target.value)} />
      </label>
      <label>Motorista
        <select value={motoristaId} onChange={e => setMotoristaId(e.target.value)}>
          <option value="">Sem atribuição</option>
          {opcoes.motoristas.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
        </select>
      </label>
      {Object.entries(nomesEtapaConteiner).filter(([tipo]) => tipo !== 'troca').map(([tipo, titulo], i) => {
        const etapa = etapas[i];
        const campo = (chave, label, props = {}) => <label>{label}
          <input {...props} value={etapa[chave] ?? ''} onChange={e => alterar(i, { [chave]: e.target.value })} />
        </label>;
        return <fieldset key={tipo} className="central-form central-full">
          <legend>{i + 1}. {titulo}</legend>
          {campo('destinatario', 'Nome do terminal, cliente ou pátio', { required: true, maxLength: 300 })}
          {campo('endereco', 'Endereço da parada', { required: true, maxLength: 300 })}
          <CoordenadasEntrega valor={etapa} alterar={dados => alterar(i, dados)}
            endereco={etapa.endereco} podeLocalizar={opcoes.geocodificador} />
          {campo('janelaInicio', 'Início da janela', { type: 'datetime-local' })}
          {campo('janelaFim', 'Fim da janela', { type: 'datetime-local' })}
          {campo('minutosServico', 'Minutos de atendimento', { type: 'number', min: 0, max: 480 })}
        </fieldset>;
      })}
      <div className="central-full">
        <button type="submit">{ocupado ? 'Salvando...' : 'Salvar as três etapas'}</button>{' '}
        <button type="button" onClick={cancelar}>Cancelar</button>
      </div>
    </fieldset>
  </form>;
}

export function HistoricoConteiner({ veiculoId, revisao }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    api.get('/tms/conteineres', { params: { veiculoId } }).then(r => {
      if (ativo) { setDados(r.data); setErro(''); }
    }).catch(() => { if (ativo) setErro('Não foi possível consultar as viagens.'); });
    return () => { ativo = false; };
  }, [aberto, veiculoId, revisao]);
  const status = { pendente: 'Pendente', em_rota: 'Em rota', entregue: 'Concluída' };
  return <details className="central-card" onToggle={e => setAberto(e.currentTarget.open)}>
    <summary>Histórico de viagens de contêiner</summary>
    {erro && <p role="alert">{erro}</p>}
    {aberto && !dados && !erro && <p>Carregando viagens...</p>}
    {dados?.dados.length === 0 && <p>Nenhuma viagem cadastrada para este veículo.</p>}
    {dados?.dados.map(viagem => <section key={viagem._id}>
      <h4>{viagem.numero} · {new Date(viagem.criadoEm).toLocaleString('pt-BR')}</h4>
      {viagem.modo === 'trocas' && <p>Rota com trocas · capacidade {viagem.capacidade} · partida {viagem.inicial?.length
        ? viagem.inicial.map(item => item.numero + ' (' + item.estado + ')').join(', ') : 'sem contêineres'}</p>}
      <ol>{viagem.etapas.map(etapa => <li key={etapa.ordem ?? etapa.tipo}>
        {nomesEtapaConteiner[etapa.tipo]} · {etapa.local} · {status[etapa.status]}
        {etapa.concluidaEm && ' em ' + new Date(etapa.concluidaEm).toLocaleString('pt-BR')}
        {etapa.movimentos?.length > 0 && <strong>Planejado</strong>}
        <ResumoMovimentos movimentos={etapa.movimentos} carga={etapa.cargaAposEtapa} />
        {etapa.movimentosRealizados?.length > 0 && <strong>Realizado</strong>}
        <ResumoMovimentos movimentos={etapa.movimentosRealizados} carga={etapa.cargaRealAposEtapa} realizado />
      </li>)}</ol>
    </section>)}
    {dados?.limitado && <p>Exibindo as 20 viagens mais recentes.</p>}
  </details>;
}
