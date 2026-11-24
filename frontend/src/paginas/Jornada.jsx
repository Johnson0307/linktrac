import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import './CentralOperacao.css';
const mensagensTeste = { nao_testado: 'Não testado', conexao_aceita: 'Acesso inicial aceito; consulta de marcações ainda não validada',
  acesso_recusado: 'Acesso recusado pelo fornecedor', endereco_pendente: 'Endereço de teste precisa ser confirmado com o suporte',
  limite_fornecedor: 'Limite de requisições do fornecedor atingido', fornecedor_indisponivel: 'Fornecedor indisponível para teste' };
const vazio = { provedor: 'solides', nomeOutro: '', liberada: false, token: '' };
const quando = valor => valor ? new Date(valor).toLocaleString('pt-BR') : 'Ainda não realizado';
export default function Jornada() {
  const { user } = useAuth();
  const podeConfigurar = permite(user, 'operacao', true);
  const administrador = user?.role === 'admin' && podeConfigurar;
  const [dados, setDados] = useState(null), [form, setForm] = useState(vazio);
  const [vinculo, setVinculo] = useState({ motoristaId: '', colaboradorExterno: '' });
  const [lembreteAtivo, setLembreteAtivo] = useState(false);
  const [ocupado, setOcupado] = useState(false), [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(''), [sucesso, setSucesso] = useState(''), [revisao, setRevisao] = useState(0);
  useEffect(() => { setDados(null); setForm(vazio); setVinculo({ motoristaId: '', colaboradorExterno: '' }); setErro(''); setSucesso(''); }, [user?.clienteId]);
  useEffect(() => {
    const controle = new AbortController(); setCarregando(true);
    api.get('/jornada', { signal: controle.signal }).then(({ data }) => {
      if (controle.signal.aborted) return;
      setDados(data.dados); const c = data.dados.conta;
      setLembreteAtivo(Boolean(data.dados.lembrete?.ativo));
      setForm({ provedor: c.provedor, nomeOutro: c.nomeOutro, liberada: c.liberada, token: '' }); setErro('');
    }).catch(e => { if (!controle.signal.aborted) setErro(e.response?.data?.mensagem || 'Não foi possível consultar a jornada.'); })
      .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    return () => controle.abort();
  }, [user?.clienteId, revisao]);
  useEffect(() => { setVinculo({ motoristaId: '', colaboradorExterno: '' }); }, [dados?.conta.provedor]);
  const alterar = campo => e => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  async function acao(metodo, caminho, corpo, mensagem) {
    setOcupado(true); setErro(''); setSucesso('');
    try {
      const { data } = await api[metodo](caminho, corpo);
      setSucesso(caminho === '/jornada/testar' ? (mensagensTeste[data.dados.estado] || 'Teste concluído') + '. ' + data.dados.aviso : mensagem);
      setForm(f => ({ ...f, token: '' })); setRevisao(v => v + 1);
    } catch (e) { setErro(e.response?.data?.mensagem || 'Não foi possível concluir a operação.'); }
    finally { setOcupado(false); }
  }
  const conta = dados?.conta;
  const mudou = Boolean(conta && form.provedor !== conta.provedor);
  const nome = conta?.provedor === 'outro' ? conta.nomeOutro : dados?.provedores?.[conta?.provedor];
  return <div className="central-page">
    <AcoesDaPagina><button disabled={ocupado || carregando} onClick={() => setRevisao(v => v + 1)}>Atualizar jornada</button></AcoesDaPagina>
    {erro && <p role="alert" className="central-error">{erro}</p>}
    {sucesso && <p role="status" className="central-success">{sucesso}</p>}
    {carregando && <p role="status">Carregando integração...</p>}
    <div className="central-card">
      <h2>Integração com o ponto da sua empresa</h2>
      <p>Mantenha o fornecedor de ponto que sua empresa já utiliza. Esta etapa prepara a configuração e os vínculos com motoristas.</p>
      <p><strong>Sincronização de marcações pendente.</strong> O registro de ponto continua no aplicativo do fornecedor.
        A Linktrac ainda não coleta ponto oficial nem importa marcações nesta tela.</p>
      {conta && <p>Fornecedor: <strong>{nome}</strong> · {conta.liberada ? 'Liberação informada pelo administrador' : 'Aguardando liberação do fornecedor'}</p>}
    </div>
    {conta && <details className="central-card">
      <summary>Lembrete de ponto ao identificar o motorista</summary>
      <p>Ignição ligada e identificação enviada pelo equipamento geram um aviso ao motorista conectado à plataforma. Apenas vincular o motorista ao veículo não dispara o aviso.</p>
      <p>Versão web: mantenha a página aberta. O app Linktrac Família ainda não recebe este lembrete com a tela fechada. Não há batida automática nem consulta ao ponto já registrado no fornecedor.</p>
      <p>Cadastre o identificador do leitor e o mesmo e-mail da conta no motorista ativo. Se já bateu o ponto, o motorista pode dispensar o lembrete.</p>
      {administrador ? <form onSubmit={e => { e.preventDefault(); acao('put', '/jornada/lembrete', { ativo: lembreteAtivo }, 'Preferência do lembrete salva. Dispensar o aviso não registra ponto.'); }}>
        <label><input type="checkbox" disabled={ocupado || carregando} checked={lembreteAtivo} onChange={e => setLembreteAtivo(e.target.checked)} /> Ativar lembrete na plataforma web</label>{' '}
        <button disabled={ocupado || carregando}>Salvar lembrete</button>
      </form> : <p>{dados.lembrete?.ativo ? 'Lembrete web ativado' : 'Lembrete web desativado'}. O administrador altera esta preferência.</p>}
    </details>}
    {conta && <details className="central-card">
      <summary>Configuração do fornecedor</summary>
      {administrador ? <form onSubmit={e => { e.preventDefault(); acao('put', '/jornada/configuracao', form, 'Configuração salva. A sincronização continua pendente de validação.'); }}>
        <fieldset className="central-form" disabled={ocupado || carregando}>
          <label>Fornecedor de ponto<select value={form.provedor} onChange={e => setForm(f => ({ ...f, provedor: e.target.value, token: '', liberada: false }))}>
            {Object.entries(dados.provedores).map(([id, titulo]) => <option key={id} value={id}>{titulo}</option>)}
          </select></label>
          {form.provedor === 'outro' && <label>Nome do fornecedor<input required maxLength={100} value={form.nomeOutro} onChange={alterar('nomeOutro')} /></label>}
          <p className="central-full">{form.provedor === 'solides' ? 'Sólides: armazenamento de token e teste de acesso inicial preparados. A API de marcações depende da confirmação do suporte.' : 'O conector deste fornecedor ainda precisa ser desenvolvido com documentação e acesso à API. A seleção registra sua preferência.'}</p>
          {mudou && <p className="central-full">Ao salvar a troca de fornecedor, a credencial anterior será removida. Os vínculos antigos serão preservados no fornecedor de origem.</p>}
          {form.provedor === 'solides' && <>
            <label className="central-full">Token de integração<input type="password" autoComplete="off" maxLength={4096} value={form.token} onChange={alterar('token')} placeholder={conta.temToken && !mudou ? 'Token já salvo. Deixe vazio para manter.' : 'Informe somente após a liberação do fornecedor'} disabled={!conta.protecaoDisponivel} /></label>
            {!conta.protecaoDisponivel && <p className="central-full">A proteção de credenciais precisa ser configurada no servidor antes de salvar um token.</p>}
          </>}
          <label className="central-full"><input type="checkbox" checked={form.liberada} onChange={alterar('liberada')} /> O fornecedor liberou o acesso para esta empresa e as condições foram conferidas</label>
          <div className="central-full"><button type="submit">Salvar fornecedor</button></div>
        </fieldset>
      </form> : <p>Somente o administrador configura as credenciais do fornecedor.</p>}
      <p>Credencial: {conta.temToken ? 'Salva e protegida no servidor' : 'Não cadastrada'}. Último teste: {quando(conta.testeEm)}.</p>
      <p>{mensagensTeste[conta.testeEstado] || 'Não testado'}</p>
      {administrador && <div>
        <p>O teste usa somente a credencial salva e não ativa a sincronização nem confirma condições comerciais.</p>
        <button disabled={ocupado || carregando || mudou || !conta.temToken || conta.provedor !== 'solides'} onClick={() => acao('post', '/jornada/testar', {}, '')}>Testar acesso inicial</button>{' '}
        <button disabled={ocupado || carregando || !conta.temToken} onClick={() => {
          if (window.confirm('Remover a credencial salva e desativar a conexão? Os vínculos serão preservados.')) acao('post', '/jornada/desconectar', {}, 'Conexão desativada e credencial removida.');
        }}>Desconectar</button>
      </div>}
    </details>}
    {conta && <section className="central-card" aria-label="Vínculos de motoristas">
      <h3>Motoristas e colaboradores no fornecedor</h3>
      <p>Use o ID ou identificador externo informado pelo fornecedor. O vínculo é preparatório e será conferido na primeira sincronização.</p>
      {podeConfigurar && <form className="central-form" onSubmit={e => { e.preventDefault(); acao('put', '/jornada/vinculos', vinculo, 'Vínculo salvo para o fornecedor selecionado.'); }}>
        <label>Motorista<select required disabled={ocupado || carregando} value={vinculo.motoristaId} onChange={e => setVinculo(v => ({ ...v, motoristaId: e.target.value }))}>
          <option value="">Selecione</option>{dados.motoristas.map(m => <option key={m._id} value={m._id}>{m.nome}</option>)}
        </select></label>
        <label>ID ou identificador externo<input required disabled={ocupado || carregando} maxLength={80} pattern="[A-Za-z0-9_.-]+" value={vinculo.colaboradorExterno} onChange={e => setVinculo(v => ({ ...v, colaboradorExterno: e.target.value }))} /></label>
        <div className="central-full"><button disabled={ocupado || carregando || mudou}>Salvar vínculo</button></div>
      </form>}
      {!dados.vinculos.length ? <p>Nenhum vínculo preparado para este fornecedor.</p> : <div className="central-scroll"><table><thead><tr><th>Motorista</th><th>ID no fornecedor</th><th>Atualizado em</th><th>Ação</th></tr></thead><tbody>
        {dados.vinculos.map(v => <tr key={v._id}><td>{dados.motoristas.find(m => m._id === v.motoristaId)?.nome || 'Motorista indisponível'}</td><td>{v.colaboradorExterno}</td><td>{quando(v.updatedAt)}</td><td>{podeConfigurar && <button disabled={ocupado} onClick={() => setVinculo({ motoristaId: v.motoristaId, colaboradorExterno: v.colaboradorExterno })}>Editar vínculo</button>}</td></tr>)}
      </tbody></table></div>}
    </section>}
  </div>;
}
