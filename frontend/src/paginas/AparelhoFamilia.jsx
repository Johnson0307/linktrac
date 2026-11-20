import { useEffect, useRef, useState } from 'react';
import './CentralOperacao.css';
const armazenamento = 'linktrac-familia-aparelho';
const lerToken = () => { try { return sessionStorage.getItem(armazenamento) || ''; } catch { return ''; } };
export default function AparelhoFamilia() {
  const [token,setToken]=useState(lerToken),[codigo,setCodigo]=useState(''),[nomeAparelho,setNomeAparelho]=useState('');
  const [nome,setNome]=useState(''),[erro,setErro]=useState(''),[mensagem,setMensagem]=useState(''),[ocupado,setOcupado]=useState(false),[ativo,setAtivo]=useState(false);
  const watch=useRef(null),ciclo=useRef(0),fila=useRef([]),enviando=useRef(false),ultimaColeta=useRef(0),ativoRef=useRef(false);
  async function chamar(caminho,body,usarToken=token){
    const resposta=await fetch('/api/familia-dispositivo'+caminho,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',...(usarToken?{Authorization:'Bearer '+usarToken}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(12000)});
    const data=await resposta.json();if(!resposta.ok)throw Object.assign(new Error(data.mensagem||'Operação indisponível.'),{status:resposta.status});return data.dados;
  }
  function pararLocal(){ciclo.current++;if(watch.current!==null){navigator.geolocation?.clearWatch(watch.current);watch.current=null;}fila.current=[];ativoRef.current=false;setAtivo(false);}
  async function interromper(aviso='Compartilhamento interrompido neste aparelho.'){
    pararLocal();setMensagem(aviso);
    if(token)try{await chamar('/pausar',{});}catch(e){setErro('O envio local foi interrompido. Não foi possível confirmar a pausa no servidor.');}
  }
  useEffect(()=>{
    let cancelado=false;
    if(token)chamar('/status').then(async dados=>{if(cancelado)return;setNome(dados.nome);setMensagem('Aparelho pareado. Toque em Iniciar para compartilhar.');if(!dados.pausado)await chamar('/pausar',{});}).catch(e=>{if(!cancelado){setErro(e.message);if([401,403].includes(e.status)){try{sessionStorage.removeItem(armazenamento);}catch{}setToken('');}}});
    const visibilidade=()=>{if(document.hidden&&ativoRef.current)interromper('Compartilhamento interrompido porque a página deixou de estar ativa. Volte à página para iniciar novamente.');};
    document.addEventListener('visibilitychange',visibilidade);
    return()=>{cancelado=true;document.removeEventListener('visibilitychange',visibilidade);pararLocal();};
  },[token]);
  async function enviar(){
    if(enviando.current||!fila.current.length||!ativoRef.current)return;
    const seq=ciclo.current,lote=fila.current.slice(0,200);enviando.current=true;
    try{await chamar('/posicoes',{pontos:lote});if(seq===ciclo.current){fila.current.splice(0,lote.length);setMensagem('Localização enviada às '+new Date().toLocaleTimeString('pt-BR')+'.');setErro('');}}
    catch(e){if(seq===ciclo.current){setErro(e.status?e.message:'Sem conexão. O último envio aguarda nesta página.');if([400,401,403,409].includes(e.status))await interromper('Compartilhamento interrompido. Confira a autorização e o horário automático do celular.');}}
    finally{enviando.current=false;}
  }
  useEffect(()=>{if(!token)return;const timer=setInterval(()=>{enviar();if(ativoRef.current)chamar('/status').then(d=>{if(d.pausado)pararLocal();}).catch(e=>{if([401,403,409].includes(e.status)){pararLocal();setErro(e.message);}});},30000);return()=>clearInterval(timer);},[token]);
  async function parear(e){e.preventDefault();setOcupado(true);setErro('');try{
    const dados=await chamar('/parear',{codigo,nomeAparelho},'');
    try{sessionStorage.setItem(armazenamento,dados.token);}catch{throw new Error('O navegador precisa permitir armazenamento nesta aba para parear. Gere outro código se necessário.');}
    setNome(dados.nome);setToken(dados.token);setCodigo('');setMensagem(dados.aviso);
  }catch(e){setErro(e.message||'Não foi possível parear.');}finally{setOcupado(false);}}
  async function iniciar(){
    if(!navigator.geolocation){setErro('Este navegador não oferece localização.');return;}
    setOcupado(true);setErro('');const seq=++ciclo.current;
    try{
      // A primeira leitura solicita a permissão; só novas leituras após o início serão enviadas.
      await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,reject,{enableHighAccuracy:true,maximumAge:0,timeout:20000}));
      if(seq!==ciclo.current||document.hidden)return;
      await chamar('/iniciar',{});
      if(seq!==ciclo.current||document.hidden){await chamar('/pausar',{});return;}
      ativoRef.current=true;setAtivo(true);ultimaColeta.current=0;setMensagem('Compartilhamento ativo. Mantenha esta página aberta.');
      watch.current=navigator.geolocation.watchPosition(pos=>{
        if(!ativoRef.current||seq!==ciclo.current||document.hidden)return;
        if(Date.now()-ultimaColeta.current<30000)return;
        ultimaColeta.current=Date.now();const c=pos.coords,velocidade=c.speed==null?undefined:c.speed*3.6;
        fila.current.push({mensagemId:crypto.randomUUID(),latitude:c.latitude,longitude:c.longitude,precisao:c.accuracy,dataHora:new Date(pos.timestamp).toISOString(),...(Number.isFinite(velocidade)&&velocidade>=0&&velocidade<=350?{velocidade}:{})});
        fila.current=fila.current.slice(-200);enviar();
      },()=>{setErro('GPS indisponível ou permissão retirada.');interromper();},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
    }catch(e){setErro(e.status?e.message:'Não foi possível obter a localização. Confira a permissão e o GPS.');pararLocal();}
    finally{setOcupado(false);}
  }
  return <div className="central-page" style={{maxWidth:700,margin:'1rem auto'}}>
    <section className="central-card"><h1>Compartilhamento de localização</h1>
      <p>Este aparelho poderá enviar sua localização para o responsável pelo cadastro. Você verá quando o envio estiver ativo e poderá interrompê-lo.</p>
      <p>Versão web: funciona com esta página aberta e ativa. Ao trocar de aplicativo ou bloquear a tela, o envio pode parar. Não é um rastreador contínuo em segundo plano.</p>
      {erro&&<p role="alert" className="central-error">{erro}</p>}{mensagem&&<p role="status">{mensagem}</p>}
      {!token?<form className="central-form" onSubmit={parear}>
        <label>Código de pareamento<input required autoComplete="off" maxLength={14} value={codigo} onChange={e=>setCodigo(e.target.value)} placeholder="XXXX-XXXX-XXXX" disabled={ocupado}/></label>
        <label>Nome deste aparelho<input required maxLength={80} value={nomeAparelho} onChange={e=>setNomeAparelho(e.target.value)} disabled={ocupado}/></label>
        <p className="central-full">Peça ao responsável o código gerado após a conferência e autorização. Ele vale 15 minutos e só pode ser usado uma vez.</p>
        <div className="central-full"><button disabled={ocupado}>Parear este aparelho</button></div>
      </form>:<>
        <p>Cadastro: <strong>{nome||'Aparelho pareado'}</strong>. Retenção das posições: até 14 dias.</p>
        <p><strong>{ativo?'COMPARTILHANDO LOCALIZAÇÃO':'COMPARTILHAMENTO INTERROMPIDO'}</strong></p>
        <button disabled={ocupado||ativo} onClick={iniciar}>Iniciar compartilhamento e permitir GPS</button>{' '}
        <button disabled={ocupado||!ativo} onClick={()=>interromper()}>Interromper compartilhamento</button>{' '}
        <button disabled={ocupado} onClick={async()=>{await interromper();try{await chamar('/desparear',{});}catch{}try{sessionStorage.removeItem(armazenamento);}catch{}setToken('');setNome('');}}>Remover acesso desta aba</button>
        <p>O acesso fica guardado somente nesta aba. Fechá-la pode exigir novo código. Nenhuma coordenada é gravada no armazenamento permanente deste navegador.</p>
      </>}
    </section>
  </div>;
}
