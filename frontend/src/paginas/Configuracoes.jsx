import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import {useEffect,useState} from 'react';
import api from '../api/api';
import {useAuth} from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import ConfigurarWhatsApp from './ConfigurarWhatsApp';
export default function Configuracoes(){
 const {user}=useAuth();const gestor=['admin','gestor'].includes(user?.role) && permite(user, 'configuracoes', true);
 const [config,setConfig]=useState(null),[campos,setCampos]=useState({}),[erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[salvando,setSalvando]=useState(false),[versao,setVersao]=useState(0);
 useEffect(()=>{let ativo=true;setErro('');setConfig(null);api.get('/operacao/configuracoes').then(({data})=>{if(ativo){setConfig(data.dados);setCampos(data.campos)}}).catch(e=>{if(ativo)setErro(e.response?.data?.mensagem||'Não foi possível carregar as configurações.')});return()=>{ativo=false}},[versao,user?.clienteId]);
 const salvar=async e=>{e.preventDefault();setSalvando(true);setErro('');setSucesso('');try{const r=await api.put('/operacao/configuracoes',Object.fromEntries(Object.entries(config).map(([k,v])=>[k,Number(v)])));setConfig(r.data.dados);setSucesso('Configurações salvas para sua empresa. Atualize as consultas abertas para aplicar os novos limites.')}catch(e){setErro(e.response?.data?.mensagem||'Não foi possível salvar.')}finally{setSalvando(false)}};
 return <div><AcoesDaPagina><button type="button" disabled={salvando} onClick={()=>setVersao(v=>v+1)}>Recarregar</button></AcoesDaPagina>{erro&&<p role="alert">{erro}</p>}{sucesso&&<p role="status">{sucesso}</p>}
 {!config&&!erro&&<p>Carregando configurações...</p>}
 {config&&<form onSubmit={salvar} style={{background:'#fff',padding:24,borderRadius:12,border:'1px solid #e2eaf0'}}><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(240px,1fr))',gap:20}}>{Object.entries(campos).map(([key,c])=><label key={key}>{c.label}<input style={{display:'block',width:'100%',marginTop:6}} aria-label={c.label} type="number" required min={c.min} max={c.max} step="any" disabled={!gestor||salvando} value={config[key]} onChange={e=>{setSucesso('');setConfig(v=>({...v,[key]:e.target.value}))}}/><small>Entre {c.min} e {c.max}. Padrão: {c.padrao}.</small></label>)}</div><p style={{marginTop:20}}>Temperatura mínima deve ser menor que a máxima. As regras são da empresa conectada. Confira os avisos na Central operacional. O WhatsApp para perda de alimentação depende da conta comercial configurada e da autorização no cadastro do veículo.</p>{gestor?<button disabled={salvando} type="submit">{salvando?'Salvando...':'Salvar configurações'}</button>:<p>Esta conta tem acesso de consulta às configurações.</p>}</form>}
 {user?.podeGerenciarEspelhamentos && <ConfigurarWhatsApp key={user.clienteId} />}
 </div>;
}
