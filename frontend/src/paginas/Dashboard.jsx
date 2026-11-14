import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import Icone from '../componentes/layout/Icone';
import MapaFrota from '../componentes/MapaFrota';
import { permite, permiteRota } from '../ajuda/acessos';
import './Dashboard.css';
export default function Dashboard({ somenteMapa = false }){
 const {user}=useAuth();
 const [parametros]=useSearchParams();
 const podeVerMapa=permite(user,'rastreamento');
 const [dados,setDados]=useState(null);
 const [erro,setErro]=useState('');
 const [carregando,setCarregando]=useState(true);
 const [versao,setVersao]=useState(0);
 const [acompanhar,setAcompanhar]=useState(false);
 const empresaAnterior=useRef(null);
 useEffect(()=>{
  if(!podeVerMapa)return;
  const controle=new AbortController();
  const escopo = String(user?.clienteId);
  if (empresaAnterior.current !== escopo) setDados(null);
  empresaAnterior.current = escopo;
  setCarregando(true);
  let timer;
  async function consultar() {
    try {
      const {data}=await api.get('/painel',{signal:controle.signal,timeout:10000});
      if(controle.signal.aborted)return;
      setErro('');
      setDados(anterior => {
        const referencias = data.dados.referenciasMapa;
        const iguais = JSON.stringify(anterior?.referenciasMapa) === JSON.stringify(referencias);
        return { ...data.dados, referenciasMapa: iguais ? anterior?.referenciasMapa : referencias };
      });
    } catch(e) {
      if(!controle.signal.aborted)setErro(e.response?.data?.mensagem||'Não foi possível carregar o painel.');
    } finally {
      if(!controle.signal.aborted) {
        setCarregando(false);
        if(acompanhar) timer=setTimeout(verificar,5000);
      }
    }
  }
  function verificar() {
    if(document.hidden) timer=setTimeout(verificar,5000);
    else consultar();
  }
  consultar();
  return()=>{ controle.abort(); clearTimeout(timer); };
 },[user?.clienteId,versao,podeVerMapa,acompanhar]);
 if(!podeVerMapa)return <div className="dashboard-page">
   {!somenteMapa && <AcoesDaPagina><Link to="/visao-plataforma">Visão geral da plataforma</Link></AcoesDaPagina>}
   <p>Bem-vindo, {user?.nome}. Use o menu para abrir as funções disponíveis para sua empresa.</p>
 </div>;
 const indicadores=[['Frota real',dados?.frotaReal,'veiculo','Próprios e espelhados autorizados','#229bd0'],['Em movimento',dados?.emMovimento,'mapa',`Última posição válida até ${(dados?.janelaComunicacaoSegundos??300)/60} min`,'#19a58e'],['Veículos com atenção',dados?.veiculosComAtencao,'historico',`Sem posição recente ou acima de ${dados?.limiteVelocidade??80} km/h`,'#e8a44f'],['Serviços registrados',dados?.servicosRegistrados,'ferramenta','Veículos reais da sua empresa','#7379cb']];
 return <div className="dashboard-page">
 <AcoesDaPagina>
   {!somenteMapa && <Link to="/visao-plataforma">Visão geral da plataforma</Link>}
   {!somenteMapa && ['admin', 'gestor'].includes(user?.role) && permite(user, 'relatorios') && <Link to="/resumo-semanal">Resumo semanal</Link>}
   {!somenteMapa && user?.role === 'admin' && permiteRota(user, '/clientes') && <Link to="/clientes">Dados da empresa</Link>}
   <button type="button" disabled={carregando} onClick={() => setVersao(v => v + 1)}>{carregando ? 'Carregando…' : 'Atualizar painel'}</button>
 </AcoesDaPagina>
 <MapaFrota veiculos={dados?.veiculosMapa} referencias={dados?.referenciasMapa}
   referenciaSelecionada={parametros.get('referencia')} carregando={carregando} erro={erro}
   acompanhar={acompanhar} aoAcompanhar={() => setAcompanhar(valor => !valor)} />
 {!somenteMapa && <>
 {erro&&<div role="alert" className="dashboard-message"><p>{erro}</p><p>{dados ? 'Os indicadores mostram a última consulta disponível.' : 'Os indicadores estão indisponíveis.'} Clique em Atualizar painel para tentar novamente.</p></div>}
 {carregando&&<p role="status">Carregando os dados da empresa...</p>}
 {dados?.frotaReal===0&&permite(user,'veiculos')&&<section className="dashboard-empty" aria-label="Frota ainda não cadastrada"><Icone nome="veiculo" tamanho={30}/><div><h3>Nenhum veículo real cadastrado ainda</h3><p>Você pode organizar a plataforma agora e adicionar os veículos quando estiver pronto.</p><Link to="/veiculos">{['admin','gestor'].includes(user?.role)?'Abrir cadastro de veículos':'Consultar veículos autorizados'} <Icone nome="seta" tamanho={16}/></Link></div></section>}
 {dados?.simulados?.length>0&&<section className="dashboard-simulation" aria-label="Veículos de demonstração"><strong>Simulação disponível, separada da frota real</strong><p>Os veículos de teste e seus serviços não entram nos indicadores abaixo.</p>{dados.simulados.map(v=><Link key={v.id} to={`/rastreamento?placa=${encodeURIComponent(v.placa)}&veiculoId=${encodeURIComponent(v.id)}`}>Consultar {v.placa} <Icone nome="seta" tamanho={14}/></Link>)}</section>}
 <div className="metrics-heading"><h3>Panorama da frota</h3><span>{dados?`Consultado em ${new Date(dados.atualizadoEm).toLocaleString('pt-BR')}`:'Aguardando consulta ao banco'}</span></div>
 <div className="dashboard-metrics">{indicadores.filter(([label])=>label!=='Serviços registrados'||permite(user,'manutencao')).map(([label,valor,icone,nota,cor])=><article className="metric-card" aria-label={label} key={label}><div className="metric-top"><span>{label}</span><span className="metric-icon" style={{color:cor,background:`${cor}12`}}><Icone nome={icone}/></span></div><strong>{dados?valor:'—'}</strong><p><span style={{background:cor}}/>{nota}</p></article>)}</div>
 {dados&&<p className="dashboard-count-note">{dados.semComunicacao} veículos reais sem posição válida nos últimos {(dados.janelaComunicacaoSegundos??300)/60} minutos. As contagens mostram os dados disponíveis no momento da consulta.</p>}
 </>}
 </div>}
