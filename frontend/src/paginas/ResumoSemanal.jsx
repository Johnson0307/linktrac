import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import './CentralOperacao.css';

const data = valor => new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
const minutos = valor => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 }) + ' min';

function Grupo({ titulo, itens, render, vazio }) {
  return <section className="central-card">
    <h3>{titulo}</h3>
    {itens.length ? <ol>{itens.map((item, i) => <li key={i}>{render(item)}</li>)}</ol> : <p>{vazio}</p>}
  </section>;
}

export default function ResumoSemanal() {
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState('');
  const [revisao, setRevisao] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/relatorios/resumo-semanal', { signal: controller.signal })
      .then(({ data: resposta }) => { if (!controller.signal.aborted) setDados(resposta.dados); })
      .catch(e => { if (!controller.signal.aborted) setErro(e.response?.data?.mensagem || 'Resumo indisponível.'); });
    return () => controller.abort();
  }, [revisao]);

  return <div className="central-page">
    <AcoesDaPagina>
      <button type="button" onClick={() => { setErro(''); setDados(null); setRevisao(v => v + 1); }}>Atualizar resumo</button>
    </AcoesDaPagina>
    {erro && <p role="alert">{erro}</p>}
    {!dados && !erro && <p role="status">Calculando resumo...</p>}
    {dados && <>
      <p>Últimos sete dias · {data(dados.inicio)} a {data(dados.fim)} · {dados.totalVeiculos} veículos próprios ativos.</p>
      {dados.limitado && <p>A consulta atingiu o limite de alertas ou planos. A lista pode estar parcial.</p>}
      <Grupo titulo="Ociosidade observada" itens={dados.ociosidade} vazio="Sem intervalos válidos de ociosidade no período."
        render={p => <><strong>{p.placa}</strong> · {minutos(p.minutos)} · semana anterior {p.minutosSemanaAnterior > 0 ? minutos(p.minutosSemanaAnterior) : 'sem intervalos observados'}</>} />
      <p>A estimativa soma intervalos curtos entre duas posições com ignição ligada e velocidade de até 3 km/h. Lacunas de transmissão ficam de fora.</p>
      <Grupo titulo="Veículos com mais alertas de risco" itens={dados.riscos} vazio="Nenhum alerta de risco recebido no período."
        render={p => <><strong>{p.placa}</strong> · {p.quantidade} alerta(s). Último registro em {data(p.ultimo.createdAt)}. {p.ultimo.mensagem}</>} />
      <Grupo titulo="Manutenção por data" itens={dados.manutencoes} vazio="Sem planos vencidos ou a vencer nos próximos sete dias."
        render={p => <><strong>{p.placa}</strong> · {p.servico} · prazo {data(p.venceEm)}</>} />
      <Grupo titulo="Alertas de manutenção" itens={dados.alertasManutencao} vazio="Nenhum alerta de manutenção no período."
        render={p => <><strong>{p.placa}</strong> · {p.mensagem}</>} />
      <Grupo titulo="Alertas de combustível" itens={dados.alertasCombustivel} vazio="Nenhum alerta de combustível recebido no período."
        render={p => <><strong>{p.placa}</strong> · {p.mensagem}</>} />
      <Link to="/operacao">Abrir Central operacional para conferir abastecimentos e manutenções</Link>
    </>}
  </div>;
}
