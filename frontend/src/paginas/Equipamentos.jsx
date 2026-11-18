import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import './CentralOperacao.css';
const CatalogoRastreadores = lazy(() => import('./CatalogoRastreadores'));

const vazio = { nome: '', fabricante: '', modelo: '', codigoExterno: '', veiculoId: '', garantiaAte: '' };
const tipos = {
  cadastro: 'Cadastro', edicao: 'Edição', transferencia: 'Transferência',
  desativacao: 'Desativação', exclusao: 'Exclusão',
};
const mensagemErro = (e) => e.response?.data?.mensagem || 'Não foi possível concluir a operação.';
const dataHora = (valor) => new Date(valor).toLocaleString('pt-BR');
const dataGarantia = valor => valor.split('-').reverse().join('/');
const campos = [
  ['nome', 'Nome do equipamento'], ['fabricante', 'Fabricante'],
  ['modelo', 'Modelo'], ['codigoExterno', 'IMEI ou código externo Traccar'],
];

function Vinculo({ vinculo }) {
  if (!vinculo) return '—';
  return <>
    {vinculo.cliente || vinculo.clienteId} · {vinculo.placa || vinculo.veiculoId}
    {vinculo.veiculo && <> · {vinculo.veiculo}</>}
    <br />
    {[vinculo.nome, vinculo.fabricante, vinculo.modelo, vinculo.codigoExterno].filter(Boolean).join(' · ')}
    {vinculo.garantiaAte && <><br />Garantia até {dataGarantia(vinculo.garantiaAte)}</>}
  </>;
}

function HistoricoEquipamentos({ dispositivo, versao }) {
  const [eventos, setEventos] = useState([]);
  const [proximo, setProximo] = useState(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState('');
  const dispositivoId = dispositivo?._id;

  useEffect(() => {
    let ativo = true;
    api.get('/operacao/dispositivos/historico', { params: { dispositivoId } })
      .then(({ data }) => {
        if (ativo) {
          setEventos(data.dados);
          setProximo(data.proximo);
        }
      })
      .catch(e => { if (ativo) setErro(mensagemErro(e)); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [dispositivoId, versao]);

  async function carregarMais() {
    setCarregando(true);
    setErro('');
    try {
      const { data } = await api.get('/operacao/dispositivos/historico', {
        params: { dispositivoId, antes: proximo },
      });
      setEventos(atuais => [...atuais, ...data.dados]);
      setProximo(data.proximo);
    } catch (e) {
      setErro(mensagemErro(e));
    } finally {
      setCarregando(false);
    }
  }

  return <section className="central-card central-scroll">
    <h3>{dispositivo ? `Histórico de ${dispositivo.nome}` : 'Histórico dos equipamentos'}</h3>
    {erro && <p role="alert">{erro}</p>}
    {!eventos.length && !carregando && !erro && <p>Nenhuma movimentação registrada.</p>}
    {eventos.length > 0 && <table>
      <thead><tr><th>Data e hora</th><th>Ação</th><th>Origem</th><th>Destino</th><th>Responsável</th></tr></thead>
      <tbody>{eventos.map(evento => <tr key={evento._id}>
        <td>{dataHora(evento.dataHora)}</td><td>{tipos[evento.tipo]}</td>
        <td><Vinculo vinculo={evento.origem} /></td><td><Vinculo vinculo={evento.destino} /></td>
        <td>{evento.usuario || '—'}</td>
      </tr>)}</tbody>
    </table>}
    {carregando && <p>Carregando histórico...</p>}
    {proximo && <button type="button" disabled={carregando} onClick={carregarMais}>Carregar mais</button>}
  </section>;
}

export function CadastroCameras() {
  const { user } = useAuth();
  return <div className="central-page">
    <Equipamentos key={user.clienteId} user={user} somenteCameras podeConfigurar={permite(user, 'equipamentos', true)} />
  </div>;
}

export default function Equipamentos({ user, somenteHistorico = false, somenteCameras = false, versao, podeConfigurar = true }) {
  const [lista, setLista] = useState([]);
  const [limitado, setLimitado] = useState(false);
  const [opcoes, setOpcoes] = useState({ empresas: [], veiculos: [] });
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState(null);
  const [consulta, setConsulta] = useState(null);
  const [token, setToken] = useState(null);
  const [revelar, setRevelar] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [revisao, setRevisao] = useState(0);
  const [identificacao, setIdentificacao] = useState(null);
  const sugeridos = useRef({});
  const codigo = form.codigoExterno.trim();
  const receptorTraccar = !somenteCameras && (form.receptorTraccar ?? /^\d{15}$/.test(codigo));
  const clienteId = form.clienteId || String(user.clienteId);

  async function carregarLista() {
    const { data } = await api.get('/operacao/dispositivos');
    setLista(data.dados);
    setLimitado(data.limitado);
  }

  useEffect(() => {
    if (!somenteHistorico) carregarLista().catch(e => setErro(mensagemErro(e)));
  }, [somenteHistorico, versao, user.clienteId]);

  useEffect(() => {
    if (somenteHistorico) return;
    let ativo = true;
    setOpcoes(atuais => ({ ...atuais, veiculos: [] }));
    api.get('/operacao/dispositivos/opcoes', { params: { clienteId } })
      .then(({ data }) => { if (ativo) setOpcoes(data); })
      .catch(e => { if (ativo) setErro(mensagemErro(e)); });
    return () => { ativo = false; };
  }, [clienteId, somenteHistorico, versao]);

  useEffect(() => {
    if (somenteHistorico || !/^\d{15}$/.test(codigo)) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const { data } = await api.get('/operacao/dispositivos/identificar', {
          params: { imei: codigo }, signal: controller.signal,
        });
        if (!controller.signal.aborted) setIdentificacao({ codigo, dados: data.dados });
      } catch {
        if (!controller.signal.aborted) setIdentificacao({ codigo, indisponivel: true });
      }
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [codigo, somenteHistorico]);

  function aplicarIdentificacao(dados) {
    const camposVazios = ['fabricante', 'modelo'].filter(campo => !form[campo].trim());
    const sugestoes = Object.fromEntries(camposVazios.map(campo => [campo, dados[campo]]));
    sugeridos.current = sugestoes;
    setForm(atuais => ({ ...atuais, ...sugestoes }));
  }

  useEffect(() => {
    if (identificacao?.codigo !== codigo || !['imei', 'base_tac'].includes(identificacao.dados?.fonte)) return;
    const camposVazios = ['fabricante', 'modelo'].filter(campo => !form[campo].trim());
    if (!camposVazios.length) return;
    const sugestoes = Object.fromEntries(camposVazios.map(campo => [campo, identificacao.dados[campo]]));
    sugeridos.current = sugestoes;
    setForm(atuais => ({ ...atuais, ...sugestoes }));
  }, [codigo, identificacao]);

  function alterarCampo(campo, valor) {
    const preenchidos = sugeridos.current;
    if (campo === 'codigoExterno' && valor.trim() !== codigo) {
      sugeridos.current = {};
      setIdentificacao(null);
      setForm(atuais => ({
        ...atuais,
        ...Object.fromEntries(Object.entries(preenchidos)
          .filter(([chave, anterior]) => atuais[chave] === anterior).map(([chave]) => [chave, ''])),
        [campo]: valor,
      }));
      return;
    }
    delete sugeridos.current[campo];
    setForm(atuais => ({ ...atuais, [campo]: valor }));
  }

  function limpar() {
    sugeridos.current = {};
    setIdentificacao(null);
    setForm(vazio);
    setEditando(null);
  }

  function editar(d) {
    sugeridos.current = {};
    setIdentificacao(null);
    setEditando(d);
    setForm({
      ...Object.fromEntries(campos.map(([campo]) => [campo, d[campo] || ''])),
      clienteId: d.clienteId?._id,
      veiculoId: d.veiculoId?._id || '',
      garantiaAte: d.garantiaAte || '',
      receptorTraccar: d.receptorTraccar === true,
    });
    setErro('');
    setMensagem('');
    setToken(null);
    document.getElementById('form-equipamento')?.scrollIntoView({ block: 'start' });
  }

  async function salvar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    setMensagem('');
    setToken(null);
    setRevelar(false);
    try {
      const dados = { ...form, receptorTraccar };
      const { data } = editando
        ? await api.put(`/operacao/dispositivos/${editando._id}`, {
            ...dados, origemClienteId: editando.clienteId?._id,
            origemVeiculoId: editando.veiculoId?._id,
          })
        : await api.post('/operacao/dispositivos', dados);
      const mudouEmpresa = editando && clienteId !== editando.clienteId?._id;
      if (data.dados?.token) setToken(data.dados);
      setMensagem(mudouEmpresa
        ? 'Equipamento transferido. Atualize a credencial na integração de destino.'
        : editando ? 'Equipamento atualizado.' : 'Equipamento cadastrado.');
      limpar();
      setRevisao(v => v + 1);
      await carregarLista();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  async function remover(d, excluir) {
    const pergunta = excluir
      ? 'Excluir este equipamento? O vínculo e a credencial serão removidos. O histórico será preservado.'
      : 'Desativar este equipamento? A entrada de dados será interrompida.';
    if (!window.confirm(pergunta)) return;
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      const url = `/operacao/dispositivos/${d._id}`;
      if (excluir) await api.delete(url);
      else await api.put(`${url}/desativar`);
      if (editando?._id === d._id) limpar();
      if (token?.id === d._id) setToken(null);
      setMensagem(excluir ? 'Equipamento excluído. Consulte o histórico para ver a origem.' : 'Equipamento desativado.');
      setRevisao(v => v + 1);
      await carregarLista();
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }

  if (somenteHistorico) return <HistoricoEquipamentos key={versao} versao={versao} />;

  return <>
    {erro && <p role="alert" className="central-error">{erro}</p>}
    {mensagem && <p role="status" className="central-success">{mensagem}</p>}
    {podeConfigurar && <form id="form-equipamento" className="central-card" onSubmit={salvar}>
      <h3>{editando ? 'Editar equipamento' : somenteCameras ? 'Cadastrar câmera ou gravador' : 'Cadastrar equipamento'}</h3>
      <fieldset disabled={ocupado} className="central-form">
        <Suspense fallback={<p>Carregando catálogo de rastreadores...</p>}>
          <CatalogoRastreadores fabricante={form.fabricante} modelo={form.modelo} somenteCameras={somenteCameras}
            selecionar={({ fabricante, modelo }) => {
              sugeridos.current = {};
              setForm(atuais => ({ ...atuais, fabricante, modelo }));
            }} />
        </Suspense>
        {campos.map(([campo, label]) => <label key={campo}>{label}
          <input required={campo === 'nome'} maxLength={100} value={form[campo]}
            onChange={e => alterarCampo(campo, e.target.value)} />
        </label>)}
        {!somenteCameras && <label className="central-full">
          <input type="checkbox" checked={receptorTraccar}
            onChange={e => setForm(v => ({ ...v, receptorTraccar: e.target.checked }))} />
          Usar o receptor da Linktrac para este rastreador
        </label>}
        {receptorTraccar && <p className="central-full">
          {opcoes.receptor
            ? `Receptor ${opcoes.receptor.endereco} · ${opcoes.receptor.protocolo} · Porta ${opcoes.receptor.porta}/${opcoes.receptor.transporte}. Outros protocolos exigem habilitação da porta correspondente.`
            : 'A sincronização depende da configuração do receptor no servidor.'}
        </p>}
        {identificacao?.codigo === codigo && <div className="central-full" aria-live="polite">
          {identificacao.dados?.fonte === 'imei' && <p>IMEI encontrado nos cadastros da sua empresa.</p>}
          {identificacao.dados?.fonte === 'base_tac' && <p>
            Base TAC configurada: {identificacao.dados.fabricante} {identificacao.dados.modelo}. Confira na etiqueta, pois a base pode identificar o módulo celular.
          </p>}
          {identificacao.dados?.fonte === 'tac' && <p>
            Mesmo prefixo de IMEI que {identificacao.dados.fabricante} {identificacao.dados.modelo}. Confirme na etiqueta.
            {(!form.fabricante.trim() || !form.modelo.trim()) && <button type="button"
              onClick={() => aplicarIdentificacao(identificacao.dados)}>Usar sugestão</button>}
          </p>}
          {!identificacao.dados && <p>{identificacao.indisponivel
            ? 'Consulta do IMEI indisponível. Você pode preencher os campos manualmente.'
            : 'IMEI sem correspondência. Use o catálogo ou preencha manualmente.'}</p>}
        </div>}
        {editando && user.podeGerenciarEspelhamentos && <label>Cliente de destino
          <select required value={clienteId}
            onChange={e => setForm(v => ({ ...v, clienteId: e.target.value, veiculoId: '' }))}>
            {opcoes.empresas.map(c => <option key={c._id} value={c._id}>{c.nome}</option>)}
          </select>
        </label>}
        <label>Garantia até
          <input type="date" value={form.garantiaAte} onChange={e => setForm(v => ({ ...v, garantiaAte: e.target.value }))} />
        </label>
        <label>Veículo
          <select required value={form.veiculoId} onChange={e => setForm(v => ({ ...v, veiculoId: e.target.value }))}>
            <option value="">Selecione</option>
            {opcoes.veiculos.map(v => <option key={v._id} value={v._id}>{v.placa} — {v.marca} {v.modelo}</option>)}
          </select>
        </label>
        <div className="central-full">
          {editando && clienteId !== editando.clienteId?._id && <p>A transferência para outro cliente gera um novo token. Se houver chip vinculado, ele volta ao estoque da empresa de origem.</p>}
          <button type="submit" disabled={!form.veiculoId}>{ocupado ? 'Processando...' : 'Salvar equipamento'}</button>
          {editando && <button type="button" onClick={limpar}>Cancelar edição</button>}
        </div>
      </fieldset>
    </form>}
    {podeConfigurar && token && <section className="central-card">
      <h3>Credencial do equipamento</h3>
      <p>Copie o token agora. Ele é exibido uma única vez.</p>
      <p>ID <code>{token.id}</code></p>
      <label>Token <input readOnly type={revelar ? 'text' : 'password'} value={token.token} /></label>
      <label><input type="checkbox" checked={revelar} onChange={e => setRevelar(e.target.checked)} /> Mostrar token</label>
      <button type="button" onClick={async () => {
        try {
          await navigator.clipboard.writeText(token.token);
          setMensagem('Token copiado.');
        } catch {
          setErro('Não foi possível copiar. Selecione o token manualmente.');
        }
      }}>Copiar token</button>
    </section>}
    <section className="central-card central-scroll">
      <h3>Saúde dos equipamentos</h3>
      <button type="button" disabled={ocupado} onClick={() => carregarLista().catch(e => setErro(e.response?.data?.mensagem || 'Não foi possível atualizar os equipamentos.'))}>Atualizar comunicação</button>
      {!lista.length ? <p>Nenhum equipamento cadastrado.</p> : <table>
        <thead><tr><th>Equipamento</th><th>Cliente</th><th>Veículo</th><th>Comunicação</th><th>Última leitura</th><th>Ações</th></tr></thead>
        <tbody>{lista.map(d => <tr key={d._id}>
          <td>{d.nome}{d.codigoExterno && <><br />{d.codigoExterno}</>}
            {d.garantiaAte && <><br />Garantia até {dataGarantia(d.garantiaAte)}</>}</td>
          <td>{d.clienteId?.nome || '—'}</td><td>{d.veiculoId?.placa || '—'}</td>
          <td><strong>{d.estadoComunicacao || '—'}</strong>
            {d.ultimaRecepcao && <><br />{dataHora(d.ultimaRecepcao)}</>}
            {d.lacunasRecepcao?.length > 0 && <details>
              <summary>Intervalos sem dados acima de 5 min</summary>
              <ul>{[...d.lacunasRecepcao].reverse().map(l => <li key={l.retomadaEm}>
                {dataHora(l.ultimaRecepcao)} até {dataHora(l.retomadaEm)}
              </li>)}</ul>
            </details>}
          </td>
          <td>
            <div>GPS: {d.ultimoGpsEm ? dataHora(d.ultimoGpsEm) : '—'}</div>
            <div>Ignição: {d.ultimaLeitura?.ignicao == null ? '—' : d.ultimaLeitura.ignicao ? 'Ligada' : 'Desligada'}</div>
            <div>Alimentação externa: {d.ultimaLeitura?.alimentacaoExterna == null ? '—' : d.ultimaLeitura.alimentacaoExterna ? 'Ligada' : 'Desligada'}</div>
            {d.ultimaLeitura?.tensaoBateria != null && <div>Tensão: {d.ultimaLeitura.tensaoBateria} V</div>}
            {d.ultimaLeitura?.dataHora && <small>Medição em {dataHora(d.ultimaLeitura.dataHora)}</small>}
          </td>
          <td>
            {podeConfigurar && <button type="button" disabled={ocupado} onClick={() => editar(d)}>Editar</button>}
            <button type="button" disabled={ocupado} onClick={() => setConsulta(d)}>Histórico</button>
            {podeConfigurar && d.ativo && <button type="button" disabled={ocupado} onClick={() => remover(d, false)}>Desativar</button>}
            {podeConfigurar && <button type="button" disabled={ocupado} onClick={() => remover(d, true)}>Excluir</button>}
          </td>
        </tr>)}</tbody>
      </table>}
      {limitado && <p>Exibindo os 500 equipamentos cadastrados mais recentemente.</p>}
    </section>
    {consulta && <>
      <HistoricoEquipamentos key={`${consulta._id}:${revisao}`} dispositivo={consulta} versao={revisao} />
      <button type="button" onClick={() => setConsulta(null)}>Fechar histórico</button>
    </>}
  </>;
}
