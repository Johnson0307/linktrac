import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useMarca } from '../../contexts/MarcaContext';
import Icone from './Icone';
import { EspacoAcoes } from './AcoesDaPagina';
import { permiteRota } from '../../ajuda/acessos';
import './NavBar.css';
const itens = [
 ['/', 'Visão geral', 'painel', 'Operação'], ['/mapa','Mapa geral','mapa','Operação'], ['/rastreamento','Rastreamento','mapa','Operação'],
 ['/monitoramento','Central de monitoramento','painel','Operação'], ['/agro','Agro e talhões','mapa','Operação'],
 ['/historicos','Históricos','historico','Operação'], ['/manutencao','Manutenção','ferramenta','Gestão'], ['/jornada','Jornada de trabalho','historico','Gestão'],
 ['/relatorios','Relatórios','relatorio','Relatórios'],
 ['/configuracoes','Configurações','ajustes','Administração'], ['/manuais','Manuais','relatorio','Ajuda']
];
const cadastros = [
 ['/rastreadores','Rastreadores','ajustes','Cadastros'],
 ['/cameras','Câmeras','camera','Cadastros'],
 ['/veiculos','Veículos','veiculo','Cadastros'],
 ['/motoristas','Motoristas','pessoas','Cadastros'],
 ['/tags-ble','Cadastro de tags','ajustes','Cadastros'],
];
export default function NavBar(){
 const {pathname}=useLocation(); const navigate=useNavigate(); const {user,logout,loading}=useAuth();
 const {marca,logo}=useMarca();
 const [aberto,setAberto]=useState(false);
 useEffect(()=>{setAberto(false)},[pathname]);
 useEffect(()=>{if(!aberto)return undefined;const fechar=e=>{if(e.key==='Escape')setAberto(false)};window.addEventListener('keydown',fechar);return()=>window.removeEventListener('keydown',fechar)},[aberto]);
 const menu=[...itens,...(user?.role==='admin'?[['/clientes','Clientes','pessoas','Cadastros']]:[]),...cadastros,...(['admin','gestor','motorista'].includes(user?.role)?[['/tms','Roteirização de entregas','carga','Operação'],['/minhas-rotas',user.role==='motorista'?'Minhas rotas':'Rotas atribuídas','mapa','Operação']]:[]),...(['admin','gestor'].includes(user?.role)?[['/manutencao-inteligente','Manutenção inteligente','ferramenta','Gestão'],['/operacao','Central operacional','ajustes','Gestão'],['/usuarios','Usuários','pessoas','Administração']]:[]),...(marca.podeEditar?[['/marca','Identidade visual','ajustes','Administração']]:[]),...(user?.podeGerenciarEspelhamentos?[['/espelhamentos','Espelhamentos','compartilhar','Administração'],['/briefings','Briefings e melhorias','relatorio','Administração']]:[])].filter(([path])=>permiteRota(user,path));
 const tituloEspecial = {
   '/visao-plataforma': 'Visão geral da plataforma',
   '/resumo-semanal': 'Resumo semanal',
   '/tms/cargas': 'Gestão de cargas',
   '/clientes': user?.podeGerenciarEspelhamentos ? 'Clientes e revendedoras' :
     user?.podeGerenciarCarteira ? 'Minha carteira de clientes' : 'Clientes',
 };
 const titulo=tituloEspecial[pathname]||menu.find(([path])=>path===(pathname==='/dashboard'?'/':pathname))?.[1]||'Sua plataforma de rastreamento';
 const sair=()=>{logout();navigate('/login')};
 if(loading)return null;
 if(!user)return <div className="public-topbar"><Link to="/login" aria-label={marca.nome + ' — entrar'}>{logo&&<img src={logo} alt={marca.padrao ? 'Linktrac — Rastreamento Veicular' : marca.nome}/>} {!marca.padrao&&<strong>{marca.nome}</strong>}</Link><span>Gestão de frotas e rastreamento</span><Link className="public-login" to="/login">Acessar plataforma <Icone nome="seta" tamanho={17}/></Link></div>;
 return <>
 <a className="pular-conteudo" href="#conteudo-principal">Ir para o conteúdo</a>
 {aberto&&<button className="sidebar-overlay" aria-label="Fechar navegação" onClick={()=>setAberto(false)}/>}
 <aside className={`app-sidebar ${aberto?'is-open':''}`} aria-label="Navegação da plataforma" id="navegacao-principal">
 <Link className="sidebar-brand" to="/" aria-label={marca.nome + ' — visão geral'}>{logo&&<img src={logo} alt={marca.padrao ? 'Linktrac — Rastreamento Veicular' : marca.nome}/>} {!marca.padrao&&<strong>{marca.nome}</strong>}</Link>
 <div className="sidebar-caption">PLATAFORMA DE OPERAÇÕES</div>
 <nav className="sidebar-navigation" aria-label="Menu principal">{['Operação','Cadastros','Gestão','Relatórios','Administração','Ajuda'].map(grupo=>{
   const links=menu.filter(item=>item[3]===grupo);
   if(!links.length)return null;
   return <details className="sidebar-group" key={grupo} open>
     <summary>{grupo}</summary>
     {links.map(([path,label,icone])=>{
       const ativo=path===(pathname==='/dashboard'?'/':pathname);
       return <Link key={path} to={path} className={ativo?'is-active':''} aria-current={ativo?'page':undefined}>
         <Icone nome={icone}/><span>{label}</span>{ativo&&<span className="nav-active-dot"/>}
       </Link>;
     })}
   </details>;
 })}</nav>
 <div className="sidebar-bottom"><span className="brand-dot"/>Sua operação, conectada.</div></aside>
 <div className="app-topbar"><button className="mobile-menu" aria-label="Abrir navegação" aria-expanded={aberto} aria-controls="navegacao-principal" onClick={()=>setAberto(!aberto)}><Icone nome="menu"/></button>
 <div className="topbar-location"><span>{marca.padrao ? 'Linktrac' : marca.nome} <b>/</b> Operações</span><h1>{titulo}</h1></div>
 <EspacoAcoes />
 <div className="topbar-account"><div className="account-avatar">{(user.nome||'L').trim().slice(0,1).toUpperCase()}</div><div className="account-info"><strong>{user.nome}</strong><span>{({admin:'Administrador',gestor:'Gestor',operador:'Operador',motorista:'Motorista'})[user.role]||'Conta da empresa'}</span></div><button className="logout-button" onClick={sair} aria-label="Sair da plataforma"><Icone nome="sair" tamanho={18}/><span>Sair</span></button></div></div>
 </>;
}
