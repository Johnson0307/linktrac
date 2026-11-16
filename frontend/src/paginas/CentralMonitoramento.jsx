import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import MapaTrajeto from '../componentes/MapaTrajeto';
import './CentralOperacao.css';

const rota = '/operacao/ocorrencias';
const estados = { aberta: 'Abertas', em_atendimento: 'Em atendimento', encerrada: 'Encerradas' };
const acoes = { aberta: 'Abriu a ocorrência', assumir: 'Assumiu o atendimento', anotar: 'Registrou uma ação', encerrar: 'Encerrou a ocorrência' };
const tipos = { alimentacao_desconectada: 'Perda de alimentação', movimento_sem_ignicao: 'Movimento com a ignição desligada' };
const hora = valor => new Date(valor).toLocaleString('pt-BR');
const mensagem = (e, texto) => e.response?.data?.mensagem || texto;

export default function CentralMonitoramento() {
  const { user } = useAuth();
  const [estado, setEstado] = useState('aberta');
  const [fila, setFila] = useState(null);
  const [id, setId] = useState(null);
  const [ficha, setFicha] = useState(null);
  const [texto, setTexto] = useState('');
  const [erro, setErro] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [simular, setSimular] = useState(false);
  const [veiculos, setVeiculos] = useState([]);
  const [veiculoId, setVeiculoId] = useState('');
  const [tipo, setTipo] = useState('alimentacao_desconectada');
  const [versao, setVersao] = useState(0);
  const podeSimular = ['admin', 'gestor'].includes(user.role) && (user.podeGerenciarEspelhamentos || permite(user, 'operacao', true));
  const pontos = useMemo(() => ficha?.posicao ? [ficha.posicao] : [], [ficha?.posicao]);

  useEffect(() => {
    let ativo = true;
    let pendente = false;
    const consultar = async () => {
      if (pendente) return;
      pendente = true;
      try {
        const { data } = await api.get(rota, { params: { estado }, timeout: 8000 });
        if (ativo) setFila(data);
      } catch (e) {
        if (ativo) setErro(mensagem(e, 'Não foi possível atualizar a fila.'));
      } finally {
        pendente = false;
      }
    };
    consultar();
    const timer = setInterval(consultar, 10000);
    return () => { ativo = false; clearInterval(timer); };
  }, [estado, versao, user.clienteId]);

  useEffect(() => {
    if (!id) return;
    let ativo = true;
    api.get(`${rota}/${id}`, { timeout: 8000 }).then(({ data }) => {
      if (ativo) setFicha(data.dados);
    }).catch(e => {
      if (ativo) setErro(mensagem(e, 'Não foi possível abrir a ficha.'));
    });
    return () => { ativo = false; };
  }, [id, versao]);

  function selecionarEstado(novo) {
    if (estado !== novo) {
      setFila(null);
      setEstado(novo);
    }
  }

  async function executar(acao) {
    setErro('');
    setOcupado(true);
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e, 'Não foi possível concluir a ação.'));
      if (e.response?.status === 409) setVersao(v => v + 1);
    } finally {
      setOcupado(false);
    }
  }

  function registrar(acao) {
    return executar(async () => {
      await api.patch(`${rota}/${id}`, { acao, texto, revisao: ficha.ocorrencia.revisao }, { timeout: 8000 });
      if (acao === 'assumir') selecionarEstado('em_atendimento');
      if (acao === 'encerrar') selecionarEstado('encerrada');
      setTexto('');
      setVersao(v => v + 1);
    });
  }

  const atendimento = ficha?.ocorrencia;
  const podeAtender = fila?.podeEditar && atendimento?.estado === 'em_atendimento' &&
    (user.role !== 'operador' || String(atendimento.responsavel?.id) === String(user.id));

  return <div className="central-page">
    {erro && <p role="alert">{erro}</p>}
    <section className="central-card central-scroll">
      <h2>Fila de ocorrências</h2>
      {Object.entries(estados).map(([chave, rotulo]) => <button key={chave} type="button"
        disabled={ocupado} aria-pressed={estado === chave} onClick={() => selecionarEstado(chave)}>{rotulo}</button>)}
      <button type="button" disabled={ocupado} onClick={() => { setErro(''); setVersao(v => v + 1); }}>Atualizar</button>
      {podeSimular && <button type="button" disabled={ocupado} aria-expanded={simular} onClick={() => {
        if (simular) return setSimular(false);
        executar(async () => {
          const { data } = await api.get(`${rota}/veiculos-teste`, { timeout: 8000 });
          setVeiculos(data.dados);
          setSimular(true);
        });
      }}>Simular alerta</button>}
      {simular && <form onSubmit={e => {
        e.preventDefault();
        executar(async () => {
          await api.post(`${rota}/simular`, { veiculoId, tipo }, { timeout: 8000 });
          selecionarEstado('aberta');
          setSimular(false);
          setVersao(v => v + 1);
        });
      }}>
        <label>Tipo de alerta<select value={tipo} onChange={e => setTipo(e.target.value)}>
          {Object.entries(tipos).map(([chave, rotulo]) => <option key={chave} value={chave}>{rotulo}</option>)}
        </select></label>
        <label>Veículo para teste<select required value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
          <option value="">Selecione</option>
          {veiculos.map(v => <option key={v._id} value={v._id}>{v.placa}</option>)}
        </select></label>
        <button disabled={ocupado || !veiculoId}>Criar ocorrência de teste</button>
        <p>A simulação aparece na fila com a marca de teste e mantém o WhatsApp sem envio.</p>
      </form>}
      {!fila && !erro && <p>Carregando fila…</p>}
      {fila?.dados.length === 0 && <p>Nenhuma ocorrência neste estado.</p>}
      {fila?.dados.length > 0 && <table>
        <thead><tr><th>Prioridade</th><th>Alerta</th><th>Veículo</th><th>Horário</th><th>Responsável</th><th>Ficha</th></tr></thead>
        <tbody>{fila.dados.map(item => <tr key={item._id}>
          <td>{item.simulado ? 'Simulação' : 'Alta'}</td><td>{tipos[item.tipo] || 'Alerta'}</td><td>{item.placa || '—'}</td>
          <td>{hora(item.ocorridoEm || item.createdAt)}</td><td>{item.ocorrencia.responsavel?.nome || '—'}</td>
          <td><button type="button" disabled={ocupado} onClick={() => {
            if (item._id !== id) setFicha(null);
            setId(item._id); setTexto(''); setErro('');
          }}>Abrir ficha</button></td>
        </tr>)}</tbody>
      </table>}
      {fila?.limitado && <p>Exibindo as primeiras 100 ocorrências deste estado.</p>}
    </section>
    {id && !ficha && !erro && <p role="status">Carregando ocorrência…</p>}
    {ficha && <section className="central-card" aria-label="Ficha da ocorrência">
      <h2>{tipos[ficha.tipo] || 'Alerta'} {ficha.simulado && '· Simulação'}</h2>
      <p>{ficha.mensagem}</p>
      {ficha.veiculo && <p>Veículo {ficha.veiculo.placa} · {ficha.veiculo.nomeCliente}
        {!ficha.simulado && ficha.veiculo.telefone && <> · <a href={`tel:${ficha.veiculo.telefone.replace(/[^\d+]/g, '')}`}>Ligar para o contato</a></>}</p>}
      {pontos.length > 0 && <>
        <p>Última posição registrada em {hora(ficha.posicao.dataHora)}.
          {permite(user, 'rastreamento') && <> <Link to={`/rastreamento?placa=${encodeURIComponent(ficha.veiculo.placa)}&veiculoId=${ficha.veiculo._id}`}>Abrir rastreamento</Link></>}</p>
        <MapaTrajeto posicoes={pontos} modo="posicao" />
      </>}
      {!ficha.simulado && !pontos.length && <p>Sem posição disponível na ficha.</p>}
      {atendimento.estado !== 'encerrada' && <details open>
        <summary>Roteiro de atendimento</summary>
        <ol>
          <li>Confira o horário do alerta e da última posição.</li>
          <li>{ficha.tipo === 'movimento_sem_ignicao'
            ? 'Confirme com o cliente se houve reboque, transporte autorizado ou problema na leitura da ignição.'
            : 'Confirme com o cliente se houve manutenção ou desligamento previsto.'}</li>
          <li>Registre o contato, a ação tomada e o desfecho.</li>
        </ol>
      </details>}
      {atendimento.estado === 'aberta' && fila?.podeEditar &&
        <button type="button" disabled={ocupado} onClick={() => registrar('assumir')}>Assumir atendimento</button>}
      {podeAtender && <form onSubmit={e => { e.preventDefault(); registrar('anotar'); }}>
        <label>Ação tomada ou desfecho<textarea required maxLength={500} value={texto} onChange={e => setTexto(e.target.value)} /></label>
        <button type="submit" disabled={ocupado || !texto.trim()}>Registrar ação</button>
        <button type="button" disabled={ocupado || !texto.trim()} onClick={() => registrar('encerrar')}>Encerrar ocorrência</button>
      </form>}
      <h3>Histórico do atendimento</h3>
      <ol>{atendimento.historico.map((item, indice) => <li key={indice}>
        {hora(item.em)} · {item.nome} · {acoes[item.tipo]}{item.texto && <p>{item.texto}</p>}
      </li>)}</ol>
    </section>}
  </div>;
}
