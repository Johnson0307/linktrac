import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import api from '../api/api';
import CoordenadasEntrega, { ponto } from './CoordenadasEntrega';
import RotaEntregas from './RotaEntregas';
import RotaTrocasConteiner, { ResumoMovimentos } from './RotaTrocasConteiner';
import ViagemConteiner, { HistoricoConteiner, nomesEtapaConteiner, acoesEtapaConteiner } from './ViagemConteiner';
import { codigoDaLeitura, lerXmlNfe } from './notaFiscal';
import { FormExecucaoEntrega, HistoricoEntregas, RegistroExecucao } from './ExecucaoEntrega';
import './CentralOperacao.css';

const LeitorEntrega = lazy(() => import('./LeitorEntrega'));
const mensagem = (e) => e.response?.data?.mensagem || e.message || 'Não foi possível concluir.';
const aberto = (p) => ['pendente', 'em_rota'].includes(p.dados.status);
const horaIso = (valor) => valor ? new Date(valor).toISOString() : undefined;
const opcoesIniciais = { veiculos: [], motoristas: [], vinculados: null };

export default function Tms() {
  const { user } = useAuth();
  const podeUsar = ['admin', 'gestor', 'motorista'].includes(user?.role);
  return podeUsar
    ? <PainelTms key={String(user.id || user.clienteId)} gestor={user.role !== 'motorista'} podeAlterar={permite(user, 'entregas', true)} />
    : <p>O TMS é disponível para administradores, gestores e motoristas.</p>;
}

function PainelTms({ gestor, podeAlterar }) {
  const [opcoes, setOpcoes] = useState(opcoesIniciais);
  const [veiculoId, setVeiculoId] = useState('');
  const [erro, setErro] = useState('');
  useEffect(() => {
    let ativo = true;
    api.get('/tms/opcoes').then(({ data }) => {
      if (!ativo) return;
      setOpcoes(data);
      if (data.veiculos.length === 1) setVeiculoId(data.veiculos[0]._id);
    }).catch(e => { if (ativo) setErro(mensagem(e)); });
    return () => { ativo = false; };
  }, []);

  return <div className="central-page">
    <AcoesDaPagina>
      <select aria-label="Veículo da rota" value={veiculoId} onChange={e => setVeiculoId(e.target.value)}>
        <option value="">Veículo da rota</option>
        {opcoes.veiculos.map(v => <option key={v._id} value={v._id}>{v.placa} — {v.marca} {v.modelo}</option>)}
      </select>
      {gestor && <Link to="/tms/cargas">Gestão de cargas</Link>}
    </AcoesDaPagina>
    {erro && <p role="alert">{erro}</p>}
    {!gestor && !opcoes.veiculos.length && !erro && <p>Os veículos vinculados e as entregas atribuídas aparecem aqui.</p>}
    {veiculoId && <EntregasDoVeiculo key={veiculoId} veiculoId={veiculoId} opcoes={opcoes} gestor={gestor} podeAlterar={podeAlterar} />}
  </div>;
}

function EntregasDoVeiculo({ veiculoId, opcoes, gestor, podeAlterar }) {
  const [paradas, setParadas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [selecionados, setSelecionados] = useState([]);
  const [fila, setFila] = useState([]);
  const [codigo, setCodigo] = useState('');
  const [camera, setCamera] = useState(false);
  const [novaViagem, setNovaViagem] = useState(null);
  const [revisaoViagens, setRevisaoViagens] = useState(0);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [localizando, setLocalizando] = useState(null);
  const [execucao, setExecucao] = useState(null);
  const [revisaoEntregas, setRevisaoEntregas] = useState(0);
  const [coordenadas, setCoordenadas] = useState({});
  const podeIncluir = podeAlterar && (gestor || opcoes.vinculados?.includes(veiculoId));

  useEffect(() => {
    let ativo = true;
    api.get('/tms/paradas', { params: { veiculoId } }).then(({ data }) => {
      if (!ativo) return;
      setParadas(data.dados);
      setSelecionados(data.dados.slice(0, 50).map(p => p._id));
      if (data.limitado) setAviso('A lista mostra as 200 paradas pendentes mais recentes deste veículo.');
    }).catch(e => { if (ativo) setErro(mensagem(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [veiculoId]);

  function incluirNaRota(parada) {
    setParadas(atuais => atuais.some(p => p._id === parada._id)
      ? atuais.map(p => p._id === parada._id ? parada : p)
      : [parada, ...atuais]);
    setSelecionados(atuais => atuais.includes(parada._id) || atuais.length >= 50 ? atuais : [...atuais, parada._id]);
  }

  async function consultarCodigo(valor) {
    setErro('');
    setAviso('');
    setOcupado(true);
    try {
      const leitura = codigoDaLeitura(valor);
      const { data } = await api.get('/tms/paradas', { params: { veiculoId, codigo: leitura.codigo } });
      const parada = data.dados.find(aberto);
      if (parada) {
        incluirNaRota(parada);
        setAviso(selecionados.length >= 50 && !selecionados.includes(parada._id) ? 'Entrega encontrada. Desmarque outra parada para incluí-la.' : 'Entrega encontrada e selecionada na rota.');
      } else if (data.dados.length) {
        setAviso('Essa entrega já está concluída ou cancelada.');
      } else if (podeIncluir) {
        setFila(atuais => atuais.some(p => p.codigo === leitura.codigo) ? atuais : [...atuais, leitura]);
        setAviso('Código lido. Importe o XML correspondente ou informe o endereço para criar a parada.');
      } else {
        setAviso('Código sem entrega atribuída a este veículo. Confira com o gestor.');
      }
      setCodigo('');
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  async function importar(e) {
    const arquivos = Array.from(e.target.files || []);
    e.target.value = '';
    if (!arquivos.length) return;
    setErro('');
    setAviso('');
    if (arquivos.length > 20) {
      setErro('Importe até 20 arquivos por vez.');
      return;
    }
    const novos = [];
    const falhas = [];
    for (const arquivo of arquivos) {
      try {
        if (arquivo.size > 5 * 1024 * 1024) throw new Error('Limite de 5 MB por arquivo.');
        novos.push(lerXmlNfe(await arquivo.text()));
      } catch (err) {
        falhas.push(`${arquivo.name}: ${mensagem(err)}`);
      }
    }
    setFila(atuais => {
      const porCodigo = new Map(atuais.map(p => [p.codigo, p]));
      for (const nota of novos) porCodigo.set(nota.codigo, { ...porCodigo.get(nota.codigo), ...nota });
      return [...porCodigo.values()];
    });
    if (novos.length) setAviso(`${novos.length} arquivo(s) lido(s). Revise e salve as paradas.`);
    if (falhas.length) setErro(falhas.join(' '));
  }

  async function salvarParada(dados) {
    setErro('');
    setAviso('');
    setOcupado(true);
    try {
      const r = await api.post('/tms/paradas', { ...dados, veiculoId });
      incluirNaRota(r.data.dados);
      setFila(atuais => atuais.slice(1));
      setAviso(selecionados.length >= 50 ? 'Parada salva. Desmarque outra parada para incluí-la na rota.' : 'Parada salva e selecionada.');
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  async function atualizarStatus(id, status, campos = {}) {
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.patch(`/tms/paradas/${id}/status`, { status, ...campos });
      setParadas(atuais => atuais.map(p => p._id === id ? data.dados : p));
      if (status === 'entregue') setSelecionados(ids => ids.filter(item => item !== id));
      if (status === 'entregue') setRevisaoEntregas(v => v + 1);
      if (data.dados.dados.viagemConteinerId) setRevisaoViagens(v => v + 1);
      setAviso({ entregue: 'Etapa concluída.', em_rota: 'Parada em rota.',
        chegada: 'Chegada registrada.', tentativa: 'Tentativa registrada. A entrega pode ser tentada novamente.' }[status]);
      return true;
    } catch (err) {
      setErro(mensagem(err));
      return mensagem(err);
    } finally {
      setOcupado(false);
    }
  }

  function abrirConclusao(id) {
    const parada = paradas.find(p => p._id === id && aberto(p));
    if (parada) setExecucao({ parada, tipo: 'entregue' });
  }

  async function salvarLocalizacao(e) {
    e.preventDefault();
    const local = ponto(coordenadas);
    if (!local) return;
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.patch(`/tms/paradas/${localizando._id}/localizacao`, local);
      setParadas(atuais => atuais.map(p => p._id === data.dados._id ? data.dados : p));
      setLocalizando(null);
    } catch (err) {
      setErro(mensagem(err));
    } finally {
      setOcupado(false);
    }
  }

  const FormularioViagem = novaViagem === 'trocas' ? RotaTrocasConteiner : ViagemConteiner;
  return <>
    {erro && <p role="alert" className="central-error">{erro}</p>}
    {aviso && <p role="status" className="central-success">{aviso}</p>}
    <section className="central-card">
      <h3>Adicionar entregas</h3>
      <form onSubmit={e => { e.preventDefault(); consultarCodigo(codigo); }}>
        <label>Chave da nota ou código da etiqueta
          <input value={codigo} onChange={e => setCodigo(e.target.value)} maxLength={1024} />
        </label>
        <button type="submit" disabled={carregando || ocupado || !codigo.trim()}>Buscar código</button>{' '}
        <button type="button" disabled={carregando || ocupado || camera} onClick={() => setCamera(true)}>Abrir câmera</button>
      </form>
      {camera && <Suspense fallback={<p>Preparando o leitor...</p>}>
        <LeitorEntrega aoLer={consultarCodigo} fechar={() => setCamera(false)} />
      </Suspense>}
      {podeAlterar && gestor && !novaViagem && <div>
        <button type="button" disabled={carregando || ocupado} onClick={() => setNovaViagem('simples')}>Nova viagem de contêiner</button>{' '}
        <button type="button" disabled={carregando || ocupado} onClick={() => setNovaViagem('trocas')}>Nova rota com trocas</button>
      </div>}
      {podeIncluir && <>
        <label>Importar XML da NF-e
          <input type="file" accept=".xml,application/xml,text/xml" multiple disabled={carregando || ocupado} onChange={importar} />
        </label>
        <button type="button" disabled={carregando || ocupado} onClick={() => setFila(atuais => [...atuais, { codigo: '' }])}>Adicionar parada manual</button>
      </>}
      <p>A leitura procura a nota ou etiqueta cadastrada. O XML fornece o endereço de uma nota nova.</p>
    </section>
    {novaViagem && <FormularioViagem veiculoId={veiculoId} opcoes={opcoes}
      cancelar={() => setNovaViagem(null)} aoSalvar={etapas => {
        setParadas(atuais => [...etapas, ...atuais]);
        if (selecionados.length + etapas.length <= 50) {
          setSelecionados(ids => [...ids, ...etapas.map(p => p._id)]);
          setAviso('Viagem salva. As paradas estão selecionadas para a rota.');
        } else {
          setAviso('Viagem salva. Libere espaço na seleção para incluir todas as etapas da viagem.');
        }
        setErro('');
        setNovaViagem(null);
        setRevisaoViagens(v => v + 1);
      }} />}
    <HistoricoConteiner veiculoId={veiculoId} revisao={revisaoViagens} />
    <HistoricoEntregas veiculoId={veiculoId} revisao={revisaoEntregas} />
    {fila.length > 0 && <NovaParada key={JSON.stringify(fila[0])} inicial={fila[0]} total={fila.length}
      opcoes={opcoes} gestor={gestor} ocupado={ocupado} salvar={salvarParada}
      pular={() => setFila(atuais => atuais.slice(1))} />}
    <section className="central-card central-scroll">
      <h3>Paradas do veículo</h3>
      {carregando && <p>Carregando paradas...</p>}
      {!carregando && !paradas.length && <p>Nenhuma parada pendente.</p>}
      {paradas.length > 0 && <div>
        <button type="button" onClick={() => setSelecionados(paradas.filter(p => aberto(p) && ponto(p.dados)).slice(0, 50).map(p => p._id))}>Selecionar paradas localizadas</button>{' '}
        <button type="button" onClick={() => setSelecionados([])}>Limpar seleção</button>
      </div>}
      {paradas.length > 0 && <table>
        <thead><tr><th>Na rota</th><th>Entrega</th><th>Endereço</th><th>Situação</th><th>Ações</th></tr></thead>
        <tbody>{paradas.map(p => <tr key={p._id}>
          <td><input type="checkbox" aria-label={`Incluir ${p.dados.codigo} na rota`}
            checked={aberto(p) && selecionados.includes(p._id)}
            disabled={!aberto(p) || (!selecionados.includes(p._id) && selecionados.length >= 50)}
            onChange={e => setSelecionados(ids => e.target.checked ? [...ids, p._id] : ids.filter(id => id !== p._id))} /></td>
          <td><strong>{p.dados.destinatario}</strong><br />
            {p.dados.etapaConteiner ? nomesEtapaConteiner[p.dados.etapaConteiner] : p.dados.codigo}
            {p.dados.referenciaCarga && <><br />{p.dados.referenciaCarga}</>}
          </td>
          <td>{p.dados.endereco}{!ponto(p.dados) && <><br />Localização pendente</>}
            <ResumoMovimentos movimentos={p.dados.movimentosConteiner} carga={p.dados.cargaAposEtapa} />
          </td>
          <td>{({ pendente: 'Pendente', em_rota: 'Em rota', entregue: 'Entregue', cancelada: 'Cancelada' })[p.dados.status]}
            <RegistroExecucao parada={p} />
          </td>
          <td>{podeAlterar && aberto(p) && <>
            <button type="button" disabled={ocupado} onClick={() => {
              setLocalizando(p);
              setCoordenadas({ latitude: p.dados.latitude, longitude: p.dados.longitude });
            }}>Definir local</button>{' '}
            {p.dados.status === 'pendente' && <button type="button" disabled={ocupado} onClick={() => atualizarStatus(p._id, 'em_rota')}>Iniciar entrega</button>}{' '}
            {!p.dados.chegouEm && <button type="button" disabled={ocupado} onClick={() => atualizarStatus(p._id, 'chegada')}>Registrar chegada</button>}{' '}
            <button type="button" disabled={ocupado} onClick={() => setExecucao({ parada: p, tipo: 'tentativa' })}>Registrar tentativa</button>{' '}
            <button type="button" disabled={ocupado} onClick={() => abrirConclusao(p._id)}>{acoesEtapaConteiner[p.dados.etapaConteiner] || 'Concluir entrega'}</button>
          </>}</td>
        </tr>)}</tbody>
      </table>}
    </section>
    {localizando && <form key={localizando._id} className="central-card" onSubmit={salvarLocalizacao}>
      <h3>Local da entrega</h3>
      <p>{localizando.dados.endereco}</p>
      <fieldset className="central-form" disabled={ocupado}>
        <CoordenadasEntrega valor={coordenadas} alterar={dados => setCoordenadas(v => ({ ...v, ...dados }))}
          endereco={localizando.dados.endereco} podeLocalizar={opcoes.geocodificador} />
        <button type="submit" disabled={!ponto(coordenadas)}>Salvar localização</button>
        <button type="button" onClick={() => setLocalizando(null)}>Cancelar</button>
      </fieldset>
    </form>}
    <RotaEntregas veiculoId={veiculoId} selecionados={selecionados}
      paradas={paradas} provedores={opcoes} aoConcluir={podeAlterar ? abrirConclusao : undefined} atualizando={ocupado} />
    {execucao && <FormExecucaoEntrega key={execucao.parada._id + ':' + execucao.tipo}
      parada={execucao.parada} tipo={execucao.tipo} ocupado={ocupado} cancelar={() => setExecucao(null)}
      salvar={async campos => {
        const resultado = await atualizarStatus(execucao.parada._id, execucao.tipo, campos);
        if (resultado !== true) throw new Error(resultado);
        setExecucao(null);
      }} />}
  </>;
}

function NovaParada({ inicial, total, opcoes, gestor, ocupado, salvar, pular }) {
  const [form, setForm] = useState(inicial);
  const [erro, setErro] = useState('');
  const alterar = dados => setForm(v => ({ ...v, ...dados }));
  const campo = (chave, label, props = {}) => <label key={chave}>{label}
    <input {...props} value={form[chave] ?? ''} onChange={e => alterar({ [chave]: e.target.value })} />
  </label>;

  return <form className="central-card" onSubmit={e => {
    e.preventDefault();
    setErro('');
    const coordenadas = ponto(form);
    if (!coordenadas && (form.latitude !== undefined && form.latitude !== '' || form.longitude !== undefined && form.longitude !== '')) {
      setErro('Preencha latitude e longitude juntas.');
      return;
    }
    salvar({ ...form, latitude: undefined, longitude: undefined, ...coordenadas,
      janelaInicio: horaIso(form.janelaInicio), janelaFim: horaIso(form.janelaFim),
      minutosServico: form.minutosServico === undefined || form.minutosServico === '' ? 10 : Number(form.minutosServico) });
  }}>
    <h3>Revisar parada{total > 1 && ` · ${total} na fila`}</h3>
    {erro && <p role="alert">{erro}</p>}
    <fieldset className="central-form" disabled={ocupado}>
      {campo('codigo', 'Código da entrega', { required: true, maxLength: 100, readOnly: Boolean(form.chaveNfe) })}
      {campo('destinatario', 'Destinatário', { required: true, maxLength: 300 })}
      {campo('endereco', 'Endereço completo', { required: true, maxLength: 300 })}
      {campo('referenciaCarga', 'Referência da carga ou contêiner', { maxLength: 300 })}
      {gestor && <label>Motorista
        <select value={form.motoristaId || ''} onChange={e => alterar({ motoristaId: e.target.value })}>
          <option value="">Sem atribuição</option>
          {opcoes.motoristas.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
        </select>
      </label>}
      <CoordenadasEntrega valor={form} alterar={alterar} endereco={form.endereco} podeLocalizar={opcoes.geocodificador} />
      {campo('janelaInicio', 'Início da janela de entrega', { type: 'datetime-local' })}
      {campo('janelaFim', 'Fim da janela de entrega', { type: 'datetime-local' })}
      {campo('minutosServico', 'Tempo de atendimento em minutos', { type: 'number', min: 0, max: 480 })}
      <div className="central-full">
        <button type="submit">{ocupado ? 'Salvando...' : 'Salvar parada'}</button>{' '}
        <button type="button" onClick={pular}>Descartar rascunho</button>
      </div>
    </fieldset>
  </form>;
}
