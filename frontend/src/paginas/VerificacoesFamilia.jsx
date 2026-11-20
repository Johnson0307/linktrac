import { useEffect, useState } from 'react';
import api from '../api/api';
import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import './CentralOperacao.css';
export default function VerificacoesFamilia() {
  const [dados,setDados]=useState(null),[todos,setTodos]=useState(false),[item,setItem]=useState(null),[form,setForm]=useState({});
  const [erro,setErro]=useState(''),[sucesso,setSucesso]=useState(''),[ocupado,setOcupado]=useState(false),[revisao,setRevisao]=useState(0);
  useEffect(()=>{const c=new AbortController();api.get('/familia/verificacoes',{params:{estado:todos?'todos':'pendentes'},signal:c.signal}).then(({data})=>{if(!c.signal.aborted){setDados(data.dados);setErro('');}}).catch(e=>{if(!c.signal.aborted)setErro(e.response?.data?.mensagem||'Análise indisponível.');});return()=>c.abort();},[todos,revisao]);
  async function decidir(decisao){setOcupado(true);setErro('');setSucesso('');try{await api.post('/familia/verificacoes/'+item.tipo+'/'+item._id,{...form,decisao});setItem(null);setSucesso('Conferência registrada.');setRevisao(v=>v+1);}catch(e){setErro(e.response?.data?.mensagem||'Não foi possível registrar a análise.');}finally{setOcupado(false);}}
  return <div className="central-page"><AcoesDaPagina><button onClick={()=>setRevisao(v=>v+1)}>Atualizar análises</button></AcoesDaPagina>
    <p>Confira identidade, idade, contato e vínculo por procedimento apropriado. A declaração do responsável, sozinha, não comprova a responsabilidade legal. Esta tela não dá acesso a coordenadas.</p>
    {erro&&<p role="alert" className="central-error">{erro}</p>}{sucesso&&<p role="status">{sucesso}</p>}
    <label><input type="checkbox" checked={todos} onChange={e=>{setTodos(e.target.checked);setItem(null);}} /> Incluir cadastros já verificados</label>
    {dados&&[['responsavel','Responsáveis',dados.responsaveis],['menor','Menores e vínculos',dados.menores]].map(([tipo,titulo,lista])=><section className="central-card" key={tipo}><h2>{titulo}</h2><p>Até 100 cadastros por consulta.</p>
      {!lista.length?<p>Nenhum cadastro para analisar.</p>:lista.map(p=><p key={p._id}><strong>{p.nome}</strong> · {p.nascimento} · {p.contato||p.vinculo} · {p.verificacao.estado}{' '}<button disabled={ocupado} onClick={()=>{setItem({...p,tipo});setForm({});}}>Analisar</button></p>)}
    </section>)}
    {item&&<form className="central-card" onSubmit={e=>{e.preventDefault();decidir('verificado');}}><h2>Conferir {item.nome}</h2>
      <fieldset disabled={ocupado}>{item.responsavelResumo && <p>Responsável informado: {item.responsavelResumo.nome} · {item.responsavelResumo.contato}</p>}<p>Empresa: {item.clienteId}. Conta responsável: {item.usuarioId}. Referência do responsável: {item.responsavelId||item._id}.</p>
        {(item.tipo==='responsavel'?[['identidade','Conferi a identidade por meio apropriado'],['maioridade','Conferi a maioridade com evidência além da autodeclaração'],['contato','Confirmei o contato com o responsável']]:[['vinculo','Conferi a responsabilidade legal com evidência apropriada']]).map(([campo,rotulo])=><label key={campo} style={{display:'block'}}><input type="checkbox" checked={!!form[campo]} onChange={e=>setForm(v=>({...v,[campo]:e.target.checked}))} /> {rotulo}</label>)}
        <label>Referência da conferência ou motivo da suspensão<input required maxLength={200} value={form.referencia||''} onChange={e=>setForm(v=>({...v,referencia:e.target.value}))} /></label><p>Informe protocolo ou referência interna. Não cole documentos, CPF ou dados desnecessários.</p>
        <button>Aprovar conferência</button>{' '}<button type="button" onClick={()=>decidir('suspenso')}>Suspender acompanhamento</button>{' '}<button type="button" onClick={()=>setItem(null)}>Cancelar</button>
      </fieldset>
    </form>}
  </div>;
}
