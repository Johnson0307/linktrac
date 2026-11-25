import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import './CentralOperacao.css';

const endpoint = '/cliente/briefings';
const estados = {
  para_revisao: 'Para revisão', aprovada: 'Aprovada', em_execucao: 'Em execução',
  concluida: 'Concluída', descartada: 'Descartada',
};
const mensagemErro = (e) => e.response?.data?.mensagem || 'Não foi possível atualizar os briefings.';

export default function Briefings() {
  const { user } = useAuth();
  const autorizado = Boolean(user?.podeGerenciarEspelhamentos);
  const [texto, setTexto] = useState('');
  const [edicoes, setEdicoes] = useState([]);
  const [filtro, setFiltro] = useState('');
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [limite, setLimite] = useState(false);
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    if (!autorizado) return;
    const controle = new AbortController();
    api.get(endpoint, { signal: controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) {
        setEdicoes(data.dados);
        setLimite(data.limitado);
      }
    }).catch(e => { if (!controle.signal.aborted) setErro(mensagemErro(e)); });
    return () => controle.abort();
  }, [autorizado, revisao]);

  async function lerArquivo(e) {
    const arquivo = e.target.files?.[0];
    e.target.value = '';
    if (!arquivo) return;
    setErro('');
    if (arquivo.size > 60000) {
      setErro('Selecione um arquivo de texto de até 60 KB.');
      return;
    }
    try { setTexto(await arquivo.text()); }
    catch { setErro('Não foi possível ler o arquivo.'); }
  }

  async function importar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      const { data } = await api.post(endpoint, { texto });
      setTexto('');
      setAviso(`${data.novas} edição(ões) adicionada(s) e ${data.repetidas} já importada(s).`);
      setRevisao(v => v + 1);
    } catch (err) {
      setErro(mensagemErro(err));
    } finally {
      setOcupado(false);
    }
  }
  async function importarDisponiveis() {
    setOcupado(true); setErro(''); setAviso('');
    try {
      const { data } = await api.post(endpoint + '/edicoes-disponiveis', {});
      setAviso(`${data.novas} edição(ões) adicionada(s) e ${data.repetidas} já importada(s). ${data.aviso}`);
      setRevisao(v => v + 1);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function alterar(edicao, item, status) {
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      const { data } = await api.patch(`${endpoint}/${edicao._id}/itens/${item.id}`, {
        anterior: item.status, status,
      });
      setEdicoes(atuais => atuais.map(e => e._id === edicao._id ? data.dados : e));
    } catch (e) {
      setErro(mensagemErro(e));
      setRevisao(v => v + 1);
    } finally {
      setOcupado(false);
    }
  }

  if (!autorizado) return <p>A fila de briefings é exclusiva da administração central.</p>;

  return <div className="central-page">
    <AcoesDaPagina>
      <button type="button" disabled={ocupado} onClick={() => setRevisao(v => v + 1)}>Atualizar fila</button>
      <button type="button" disabled={ocupado} onClick={importarDisponiveis}>Importar edições disponíveis</button>
    </AcoesDaPagina>
    <p>As propostas de cada briefing entram na fila para revisão. A situação registrada acompanha o trabalho da equipe.</p>
    {erro && <p role="alert">{erro}</p>}
    {aviso && <p role="status">{aviso}</p>}
    <form className="central-card" onSubmit={importar}>
      <h3>Receber briefing</h3>
      <label>Arquivo de texto <input type="file" accept=".txt,text/plain" disabled={ocupado} onChange={lerArquivo} /></label>
      <label>Texto do briefing
        <textarea rows={5} value={texto} disabled={ocupado} required onChange={e => setTexto(e.target.value)} />
      </label>
      <button type="submit" disabled={ocupado || !texto.trim()}>Importar e gerar propostas</button>
    </form>
    <label className="central-area">Situação
      <select value={filtro} onChange={e => setFiltro(e.target.value)}>
        <option value="">Todas</option>
        {Object.entries(estados).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
      </select>
    </label>
    {!edicoes.some(e => e.itens.some(item => !filtro || item.status === filtro)) && <p>Nenhuma proposta nesta consulta.</p>}
    {edicoes.map(edicao => {
      const itens = edicao.itens.filter(item => !filtro || item.status === filtro);
      if (!itens.length) return null;
      return <section className="central-card" key={edicao._id}>
        <h3>Briefing de {edicao.data.split('-').reverse().join('/')}</h3>
        <p>Recebido em {new Date(edicao.createdAt).toLocaleString('pt-BR')}</p>
        {itens.map(item => <article className="central-notificacao" key={item.id}>
          <strong>{item.categoria}</strong>
          <p>{item.texto}</p>
          <label>Situação da proposta
            <select disabled={ocupado} value={item.status} onChange={e => alterar(edicao, item, e.target.value)}>
              {Object.entries(estados).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
            </select>
          </label>
          {item.revisadoEm && <small>Atualizado por {item.revisadoPor} em {new Date(item.revisadoEm).toLocaleString('pt-BR')}</small>}
        </article>)}
      </section>;
    })}
    {limite && <p>Exibindo as 100 edições mais recentes.</p>}
  </div>;
}
