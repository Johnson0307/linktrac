import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import MapaTrajeto from '../componentes/MapaTrajeto';
import './CentralOperacao.css';
const estado = { pendente: 'Pendente de conferência', verificado: 'Conferido pela Linktrac', suspenso: 'Suspenso' };
const vazio = { nome: '', nascimento: '', vinculo: 'pai' };
export default function PessoasFamilia() {
  const { user } = useAuth();
  const editar = permite(user, 'familia', true);
  const [dados, setDados] = useState(null), [adulto, setAdulto] = useState({ nome: user?.nome || '', nascimento: '', contato: '' });
  const [menor, setMenor] = useState(vazio), [revisao, setRevisao] = useState(0), [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(''), [sucesso, setSucesso] = useState(''), [codigo, setCodigo] = useState(null);
  const [autorizando, setAutorizando] = useState(null), [aceito, setAceito] = useState(false), [ciente, setCiente] = useState(false);
  const [termoApp,setTermoApp] = useState(false);
  const [historico, setHistorico] = useState(null), [seguir, setSeguir] = useState(false);
  useEffect(() => { setDados(null);setMenor(vazio);setCodigo(null);setHistorico(null);setAutorizando(null);setSeguir(false);setErro('');setSucesso(''); }, [user?.id,user?.clienteId]);
  useEffect(() => {
    const controle = new AbortController(); let timer;
    async function carregar() {
      try {
        const { data } = await api.get('/familia', { signal: controle.signal });
        if (!controle.signal.aborted) { setDados(data.dados);setHistorico(h=>h && data.dados.pessoas.some(p=>p._id===h.menorId && p.autorizado)?h:null);setErro(''); }
      } catch(e) { if (!controle.signal.aborted) {setDados(null);setHistorico(null);setErro(e.response?.data?.mensagem || 'Não foi possível consultar Pessoas e família.');} }
      if (!controle.signal.aborted && seguir) timer = setTimeout(carregar,30000);
    }
    carregar();return () => { controle.abort();clearTimeout(timer); };
  }, [user?.id,user?.clienteId,revisao,seguir]);
  async function acao(metodo,url,body,mensagem) {
    setOcupado(true);setErro('');setSucesso('');
    try {
      const { data } = await api[metodo](url,body);
      if (url.endsWith('/codigo'))setCodigo(data.dados);
      else if (url.endsWith('/historico'))setHistorico(data.dados);
      else {setCodigo(null);setHistorico(null);}
      setSucesso(mensagem);setRevisao(v=>v+1);return true;
    } catch(e) { setErro(e.response?.data?.mensagem || 'Não foi possível concluir a operação.');return false; }
    finally { setOcupado(false); }
  }
  const alterarAdulto = campo => e => setAdulto(v=>({...v,[campo]:e.target.value}));
  const r = dados?.responsavel;
  const pontos = useMemo(()=>historico?.posicoes || dados?.pessoas.filter(p=>p.ultimaPosicao).map(p=>({...p.ultimaPosicao,legenda:p.nome})) || [],[historico,dados]);
  return <div className="central-page">
    <AcoesDaPagina><button disabled={ocupado} onClick={()=>setRevisao(v=>v+1)}>Atualizar pessoas</button>{dados?.podeAnalisar && <Link to="/pessoas/verificacoes">Analisar cadastros</Link>}</AcoesDaPagina>
    {erro && <p className="central-error" role="alert">{erro}</p>}{sucesso && <p className="central-success" role="status">{sucesso}</p>}
    {!dados && !erro && <p role="status">Carregando seus cadastros...</p>}
    <p>Acompanhamento pessoal por autorização. Cada conta vê apenas os próprios cadastros. O aparelho informa quando está compartilhando a localização.</p>
    {dados && !r && editar && <form className="central-card" onSubmit={async e=>{e.preventDefault();await acao('post','/familia/responsavel',adulto,'Cadastro enviado para conferência da identidade, maioridade e contato.');}}>
      <h2>Cadastro do responsável</h2><fieldset className="central-form" disabled={ocupado}>
        <label>Nome completo<input required maxLength={120} value={adulto.nome} onChange={alterarAdulto('nome')} /></label>
        <label>Data de nascimento do responsável<input required type="date" value={adulto.nascimento} onChange={alterarAdulto('nascimento')} /></label>
        <label>Telefone com DDD<input required type="tel" maxLength={30} value={adulto.contato} onChange={alterarAdulto('contato')} /></label>
        <p className="central-full">O cadastro não libera rastreamento automaticamente. A equipe precisa conferir identidade, idade, contato e vínculo com o menor. Documentação necessária será orientada pelo atendimento; não a inclua em campos livres.</p>
        <div className="central-full"><button>Cadastrar responsável</button></div>
      </fieldset>
    </form>}
    {r && <>
      <div className="central-card"><strong>{r.nome}</strong><p>Responsável: {estado[r.verificacao]}. Telefone informado: {r.contato}.</p>
        {r.verificacao !== 'verificado' && <p>Solicite a conferência ao atendimento da Linktrac. Até a aprovação, nenhum aparelho poderá transmitir ou exibir localização.</p>}
      </div>
      {editar && <details className="central-card"><summary>Adicionar menor</summary>
        <form className="central-form" onSubmit={async e=>{e.preventDefault();if(await acao('post','/familia/menores',menor,'Cadastro criado. Registre a autorização e solicite a conferência do vínculo.'))setMenor(vazio);}}>
          <label>Nome do menor<input required maxLength={120} disabled={ocupado} value={menor.nome} onChange={e=>setMenor(v=>({...v,nome:e.target.value}))} /></label>
          <label>Data de nascimento do menor<input required type="date" disabled={ocupado} value={menor.nascimento} onChange={e=>setMenor(v=>({...v,nascimento:e.target.value}))} /></label>
          <label>Meu vínculo com o menor<select disabled={ocupado} value={menor.vinculo} onChange={e=>setMenor(v=>({...v,vinculo:e.target.value}))}>
            <option value="pai">Sou o pai</option><option value="mae">Sou a mãe</option><option value="responsavel_legal">Sou responsável legal</option>
          </select></label><div className="central-full"><button disabled={ocupado}>Cadastrar menor</button></div>
        </form>
      </details>}
      <section className="central-card"><h2>Pessoas acompanhadas</h2>
        {!dados.pessoas.length && <p>Nenhum menor cadastrado.</p>}
        {dados.pessoas.map(p=><article key={p._id} style={{borderBottom:'1px solid #dbe5ed',padding:'1rem 0'}}>
          <h3>{p.nome}</h3><p>Vínculo: {estado[p.verificacao]}. Autorização: {p.consentimento.aceitoEm && !p.consentimento.revogadoEm ? 'Registrada' : 'Pendente ou revogada'}.</p>
          <p>Aparelho: {p.aparelho.nome || 'Não pareado'} · {p.aparelho.pausado ? 'Compartilhamento interrompido' : 'Habilitado no aparelho'}.</p>
          <p>{p.ultimaPosicao ? 'Última localização: '+new Date(p.ultimaPosicao.dataHora).toLocaleString('pt-BR')+' · precisão aproximada de '+Math.round(p.ultimaPosicao.precisao)+' m.' : 'Sem localização disponível. Confira verificação, autorização e compartilhamento no aparelho.'}</p>
          {editar && <>
            <button disabled={ocupado} onClick={()=>{setTermoApp(false);setAutorizando(p);setAceito(false);setCiente(false);}}>Ler e autorizar</button>{' '}
            {dados.appDisponivel && <><button disabled={ocupado || !p.autorizado} onClick={()=>{setTermoApp(true);setAutorizando(p);setAceito(false);setCiente(false);}}>{p.autorizacaoApp?'Ler autorização do aplicativo':'Autorizar aplicativo em segundo plano'}</button>{' '}</>}
            <button disabled={ocupado || !p.autorizado} onClick={()=>acao('post','/familia/menores/'+p._id+'/codigo',{},'Código gerado. Use-o somente no aparelho que será acompanhado.')}>Adicionar ou trocar aparelho</button>{' '}
            <button disabled={ocupado} onClick={()=>{if(window.confirm('Revogar a autorização de '+p.nome+'? O envio será interrompido e as posições do banco ativo serão excluídas.'))acao('post','/familia/menores/'+p._id+'/revogar',{},'Autorização revogada e localização removida do banco ativo.');}}>Revogar autorização</button>{' '}
          </>}
          <button disabled={ocupado || !p.autorizado} onClick={()=>acao('get','/familia/menores/'+p._id+'/historico',undefined,'Consulta registrada no histórico de acessos.')}>Ver localização e histórico</button>{' '}
          {editar && <button disabled={ocupado} onClick={()=>{if(window.confirm('Excluir definitivamente o cadastro de '+p.nome+' e suas posições do banco ativo?'))acao('delete','/familia/menores/'+p._id,undefined,'Cadastro excluído.');}}>Excluir cadastro</button>}
        </article>)}
      </section>
    </>}
    {autorizando && dados && <section className="central-card" aria-label="Autorização do responsável">
      <h2>Autorização para {autorizando.nome}</h2><p>Responsável: {r?.nome}. Nascimento do menor: {autorizando.nascimento}.</p>
      {termoApp && <h3>Aplicativo Android e iPhone — localização em segundo plano</h3>}
      <pre style={{whiteSpace:'pre-wrap',fontFamily:'inherit'}}>{(termoApp?dados.termoApp:dados.termo).texto}</pre><p>Versão: {(termoApp?dados.termoApp:dados.termo).versao}</p>
      <label><input type="checkbox" checked={aceito} onChange={e=>setAceito(e.target.checked)} /> Declaro o vínculo informado e autorizo especificamente o tratamento descrito no termo.</label><br />
      <label><input type="checkbox" checked={ciente} onChange={e=>setCiente(e.target.checked)} /> Expliquei ou explicarei antes da ativação o compartilhamento ao menor, de forma adequada à idade.</label><br />
      <button disabled={ocupado || !aceito || !ciente} onClick={async()=>{const termo=termoApp?dados.termoApp:dados.termo;if(await acao('post','/familia/menores/'+autorizando._id+(termoApp?'/autorizar-app':'/autorizar'),{aceito:true,cienteMenor:true,versao:termo.versao,hash:termo.hash},'Aceite registrado. A liberação depende da conferência do responsável e do vínculo.'))setAutorizando(null);}}>Registrar autorização</button>{' '}
      <button disabled={ocupado} onClick={()=>setAutorizando(null)}>Fechar termo</button>
    </section>}
    {codigo && <section className="central-card" aria-label="Código do aparelho"><h2>Pareamento do aparelho</h2>
      <p>No celular do menor, abra a <Link to="/pessoas/aparelho" target="_blank" rel="noreferrer">Página do aparelho</Link> e digite o código. Para o piloto nativo, use o aplicativo Linktrac Família instalado e autorizado em segundo plano. O responsável acompanha pela própria conta.</p>
      <strong style={{fontSize:'1.5rem',letterSpacing:2}}>{codigo.codigo}</strong><p>Válido até {new Date(codigo.expiraEm).toLocaleString('pt-BR')}. Uso único. Um novo código substitui o aparelho anterior.</p>
      <button onClick={()=>setCodigo(null)}>Ocultar código</button>
    </section>}
    {r && <section className="central-card"><h2>{historico?'Histórico de '+historico.nome:'Localizações disponíveis'}</h2>
      <label><input type="checkbox" checked={seguir} onChange={e=>{setSeguir(e.target.checked);setHistorico(null);}} /> Atualizar localizações a cada 30 segundos enquanto esta tela estiver aberta</label>
      {historico && <><p>Até 500 posições recentes, dentro dos últimos 14 dias.{historico.limitado?' Há mais posições que o limite desta consulta.':''}</p><button onClick={()=>setHistorico(null)}>Voltar às últimas localizações</button></>}
      {pontos.length ? <MapaTrajeto posicoes={pontos} /> : <p>Nenhuma localização autorizada para mostrar.</p>}
    </section>}
  </div>;
}
