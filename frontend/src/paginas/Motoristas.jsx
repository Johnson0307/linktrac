import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import { listarMotoristas, salvarMotorista } from '../api/motoristas';
import './Motoristas.css';
const vazio = { nome:'',cpf:'',cnh:'',validadeCnh:'',categoriaCnh:'',telefone:'',email:'',endereco:'',status:'ativo',observacoes:'',identificador:'' };
const situacoes = { ativo:'Ativo', inativo:'Inativo', ferias:'Em férias' };
const campos = [['nome','Nome completo','text',120],['cpf','CPF','text',20],['cnh','Número da CNH','text',11],['validadeCnh','Validade da CNH','date',10],['telefone','Telefone (opcional)','tel',30],['email','E-mail (opcional)','email',200],['endereco','Endereço (opcional)','text',300],['identificador','RFID/iButton ou identificador integrado (opcional)','text',80]];
const formatarData = value => new Date(`${value}T00:00:00Z`).toLocaleDateString('pt-BR',{timeZone:'UTC'});
const vencida = value => { const hoje=new Date(); const dataLocal=`${hoje.getFullYear()}-${String(hoje.getMonth()+1).padStart(2,'0')}-${String(hoje.getDate()).padStart(2,'0')}`;return value<dataLocal; };
export default function Motoristas(){
 const {user}=useAuth(); const gestor=['admin','gestor'].includes(user?.role) && permite(user, 'motoristas', true);
 const [form,setForm]=useState(vazio);const [editando,setEditando]=useState(null);
 const [lista,setLista]=useState(null);const [erro,setErro]=useState('');const [erroForm,setErroForm]=useState('');const [sucesso,setSucesso]=useState('');
 const [carregando,setCarregando]=useState(true);const [salvando,setSalvando]=useState(false);
 const [busca,setBusca]=useState('');const [situacao,setSituacao]=useState('');const [consulta,setConsulta]=useState({busca:'',situacao:'',pagina:1});
 const formulario=useRef(null);
 useEffect(()=>{let ativo=true;setCarregando(true);setErro('');setLista(null);
 listarMotoristas(consulta).then(dados=>{if(ativo)setLista(dados)}).catch(e=>{if(ativo)setErro(e.response?.data?.mensagem||'Não foi possível consultar os motoristas. Tente atualizar a lista.')}).finally(()=>{if(ativo)setCarregando(false)});
 return()=>{ativo=false};},[consulta,user?.clienteId]);
 const atualizar=()=>setConsulta(c=>({...c}));
 const editar=m=>{setForm(Object.fromEntries(Object.keys(vazio).map(key=>[key,m[key]??vazio[key]])));setEditando(m._id);setSucesso('');setErroForm('');formulario.current?.scrollIntoView?.({behavior:'smooth',block:'start'});};
 const cancelar=()=>{setForm(vazio);setEditando(null);setErroForm('');};
 const salvar=async event=>{event.preventDefault();setSalvando(true);setErroForm('');setSucesso('');try{
  const resposta=await salvarMotorista(form,editando);setSucesso(`${editando?'Motorista atualizado':'Motorista cadastrado'} com sucesso.${resposta.auditoriaIndisponivel?' O registro de auditoria ficou indisponível.':''}`);
  setForm(vazio);setEditando(null);setBusca('');setSituacao('');setConsulta({busca:'',situacao:'',pagina:1});
 }catch(e){setErroForm(e.response?.data?.mensagem||'Não foi possível salvar. Confira os dados e tente novamente.');}finally{setSalvando(false);}};
 return <div className="motoristas-page"><AcoesDaPagina><button type="button" disabled={carregando||salvando} onClick={atualizar}>Atualizar lista</button></AcoesDaPagina>
 {sucesso&&<p className="motoristas-sucesso" role="status">{sucesso}</p>}
 {gestor&&<section className="motoristas-card" ref={formulario} aria-label="Cadastro de motorista"><h3>{editando?'Editar motorista':'Cadastrar motorista'}</h3><p>Os campos marcados com * são obrigatórios. Esse cadastro não cria uma conta de acesso ao sistema.</p>
 <form onSubmit={salvar}><fieldset disabled={salvando} className="motoristas-form"><legend className="visually-hidden">Dados do motorista</legend>
 {campos.map(([name,label,type,max])=><label key={name}>{label}{['nome','cpf','cnh','validadeCnh'].includes(name)?' *':''}<input aria-label={label} name={name} type={type} maxLength={max} required={['nome','cpf','cnh','validadeCnh'].includes(name)} inputMode={['cpf','cnh'].includes(name)?'numeric':undefined} value={form[name]} onChange={e=>setForm(f=>({...f,[name]:e.target.value}))}/></label>)}
 <label>Categoria da CNH *<select aria-label="Categoria da CNH" required value={form.categoriaCnh} onChange={e=>setForm(f=>({...f,categoriaCnh:e.target.value}))}><option value="">Selecione</option>{['A','B','C','D','E','AB','AC','AD','AE'].map(c=><option key={c}>{c}</option>)}</select></label>
 <label>Situação<select aria-label="Situação do motorista" value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>{Object.entries(situacoes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
 <label className="motoristas-form-full">Observações (opcional)<textarea aria-label="Observações (opcional)" rows={3} maxLength={1000} value={form.observacoes} onChange={e=>setForm(f=>({...f,observacoes:e.target.value}))}/></label>
 <p className="motoristas-form-full">CPF e CNH precisam ter 11 dígitos. A conferência é de formato; não há consulta oficial dos documentos.</p>
 {erroForm&&<p role="alert" className="motoristas-form-full motoristas-erro">{erroForm}</p>}
 <div className="motoristas-form-full motoristas-actions"><button type="submit">{salvando?'Salvando...':editando?'Salvar alterações':'Cadastrar motorista'}</button>{editando&&<button type="button" className="motoristas-secondary" onClick={cancelar}>Cancelar edição</button>}</div>
 </fieldset></form></section>}
 <section className="motoristas-card" aria-label="Motoristas da empresa"><h3>Motoristas cadastrados</h3>
 <form className="motoristas-filtros" onSubmit={e=>{e.preventDefault();setConsulta({busca,situacao,pagina:1});}}><label>Buscar por nome<input aria-label="Buscar por nome" maxLength={80} value={busca} onChange={e=>setBusca(e.target.value)}/></label><label>Filtrar situação<select aria-label="Filtrar situação" value={situacao} onChange={e=>setSituacao(e.target.value)}><option value="">Todas</option>{Object.entries(situacoes).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label><button type="submit" disabled={salvando}>Filtrar</button><button type="button" className="motoristas-secondary" disabled={salvando} onClick={()=>{setBusca('');setSituacao('');setConsulta({busca:'',situacao:'',pagina:1})}}>Limpar filtros</button></form>
 {carregando&&<p role="status">Carregando motoristas...</p>}{erro&&<p role="alert" className="motoristas-erro">{erro}</p>}
 {lista&&<><p>{lista.total} motoristas encontrados.</p>{!lista.dados.length?<p>Nenhum motorista encontrado. {gestor?'Cadastre o primeiro ou ajuste os filtros.':'Solicite o cadastro à administração da sua empresa.'}</p>:<div className="motoristas-tabela"><table><thead><tr><th>Nome</th><th>Categoria</th><th>Validade da CNH</th><th>Situação</th>{gestor&&<th>Ações</th>}</tr></thead><tbody>{lista.dados.map(m=><tr key={m._id}><td><strong>{m.nome}</strong></td><td>{m.categoriaCnh}</td><td>{formatarData(m.validadeCnh)}{vencida(m.validadeCnh)&&<span className="motoristas-vencida">Vencida</span>}</td><td><span className={`motoristas-status status-${m.status}`}>{situacoes[m.status]||m.status}</span></td>{gestor&&<td><button type="button" disabled={salvando} className="motoristas-secondary" onClick={()=>editar(m)} aria-label={`Editar ${m.nome}`}>Editar</button></td>}</tr>)}</tbody></table></div>}
 <div className="motoristas-paginacao"><button type="button" disabled={carregando||salvando||lista.pagina<=1} onClick={()=>setConsulta(c=>({...c,pagina:c.pagina-1}))}>Anterior</button><span>Página {lista.pagina} de {lista.paginas}</span><button type="button" disabled={carregando||salvando||lista.pagina>=lista.paginas} onClick={()=>setConsulta(c=>({...c,pagina:c.pagina+1}))}>Próxima</button></div></>}
 </section></div>;
}
