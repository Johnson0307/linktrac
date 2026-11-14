import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useState } from 'react';
import api from '../api/api';

const mensagemErro = erro => erro.response?.data?.mensagem || 'Não foi possível concluir a operação.';
const formatarData = valor => new Date(valor).toLocaleString('pt-BR');

export default function IntegracoesCliente({ cliente, voltar }) {
  const caminho = `/cliente/${cliente._id}/integracoes`;
  const base = new URL(`${api.defaults.baseURL.replace(/\/+$/, '')}/parceiros/v1`, window.location.origin).href;
  const [dados, setDados] = useState(null);
  const [nome, setNome] = useState('');
  const [selecionadas, setSelecionadas] = useState([]);
  const [credencial, setCredencial] = useState(null);
  const [mostrar, setMostrar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [versao, setVersao] = useState(0);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');

  useEffect(() => {
    const controle = new AbortController();
    setCarregando(true);
    api.get(caminho, { signal: controle.signal }).then(({ data }) => {
      if (!controle.signal.aborted) setDados(data.dados);
    }).catch(e => {
      if (!controle.signal.aborted) setErro(mensagemErro(e));
    }).finally(() => {
      if (!controle.signal.aborted) setCarregando(false);
    });
    return () => controle.abort();
  }, [caminho, versao]);

  async function gerar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    setAviso('');
    try {
      const { data: { dados: criada } } = await api.post(caminho, { nome: nome.trim(), permissoes: selecionadas });
      const { chave, ...ficha } = criada;
      setDados(atual => ({ ...atual, chaves: [ficha, ...atual.chaves] }));
      setCredencial(chave);
      setMostrar(false);
      setNome('');
      setSelecionadas([]);
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function revogar(chave) {
    if (!window.confirm(`Revogar a chave de ${chave.nome}? O sistema deixará de acessar a Linktrac com ela.`)) return;
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.post(`${caminho}/${chave._id}/revogar`);
      setDados(atual => ({ ...atual, chaves: atual.chaves.map(item =>
        item._id === chave._id ? { ...item, revogadaEm: data.dados.revogadaEm } : item) }));
      setAviso('Chave revogada.');
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  async function carregarMais() {
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.get(caminho, { params: { antes: dados.proximo } });
      setDados(atual => ({ ...data.dados, chaves: [...atual.chaves, ...data.dados.chaves] }));
    } catch (e) { setErro(mensagemErro(e)); }
    finally { setOcupado(false); }
  }

  return <div className="central-page">
    <AcoesDaPagina><button type="button" disabled={ocupado} onClick={voltar}>Voltar para clientes</button></AcoesDaPagina>
    <h2>Integrações de {cliente.nome}</h2>
    <div className="central-card">
      <p>Envie o endereço da API e a documentação à equipe que integra o sistema do cliente.</p>
      <p><code>{base}</code></p>
      <a href={`${base}/documentacao`} target="_blank" rel="noopener noreferrer">Abrir documentação da API</a>
    </div>
    {erro && <p role="alert">{erro}</p>}
    {aviso && <p role="status">{aviso}</p>}
    {carregando && <p role="status">Consultando chaves…</p>}
    {!dados && !carregando && <button type="button" onClick={() => { setErro(''); setVersao(v => v + 1); }}>Tentar novamente</button>}
    {credencial && <div className="central-card">
      <h3>Chave criada</h3>
      <p>Copie agora. A chave é exibida uma única vez. Compartilhe-a por um canal seguro.</p>
      <label>Chave da API <input readOnly value={credencial} type={mostrar ? 'text' : 'password'} /></label>
      <button type="button" onClick={() => setMostrar(v => !v)}>{mostrar ? 'Ocultar chave' : 'Mostrar chave'}</button>{' '}
      <button type="button" onClick={async () => {
        try { await navigator.clipboard.writeText(credencial); setAviso('Chave copiada.'); }
        catch { setAviso('Use Mostrar chave para copiar manualmente.'); }
      }}>Copiar chave</button>{' '}
      <button type="button" onClick={() => { setCredencial(null); setMostrar(false); }}>Fechar chave</button>
    </div>}
    {dados && <>
      {!credencial && <form onSubmit={gerar} className="central-card">
        <fieldset disabled={ocupado} className="central-form">
          <legend>Gerar chave de API</legend>
          <label className="central-full">Nome do sistema
            <input required maxLength={100} value={nome} onChange={e => setNome(e.target.value)} />
          </label>
          {dados.permissoes.map(p => <label key={p.id} className="central-checkbox">
            <input type="checkbox" disabled={!p.disponivel} checked={selecionadas.includes(p.id)}
              onChange={e => setSelecionadas(atuais => e.target.checked ? [...atuais, p.id] : atuais.filter(id => id !== p.id))} />
            {p.nome}{!p.disponivel && ' · módulo sem liberação'}
          </label>)}
          <div className="central-full">
            <button type="submit" disabled={!nome.trim() || !selecionadas.length}>Gerar chave</button>
          </div>
        </fieldset>
      </form>}
      <section className="central-card central-scroll">
        <h3>Chaves do cliente</h3>
        {!dados.chaves.length ? <p>Nenhuma chave cadastrada.</p> : <table>
          <thead><tr><th>Sistema</th><th>Permissões</th><th>Criada em</th><th>Situação</th><th>Ações</th></tr></thead>
          <tbody>{dados.chaves.map(chave => <tr key={chave._id}>
            <td>{chave.nome}</td>
            <td>{chave.permissoes.map(id => dados.permissoes.find(p => p.id === id)?.nome || id).join(', ')}</td>
            <td>{formatarData(chave.createdAt)}</td>
            <td>{chave.revogadaEm ? `Revogada em ${formatarData(chave.revogadaEm)}` : 'Ativa'}</td>
            <td>{!chave.revogadaEm && <button type="button" disabled={ocupado} onClick={() => revogar(chave)}>Revogar</button>}</td>
          </tr>)}</tbody>
        </table>}
        {dados.proximo && <button type="button" disabled={ocupado} onClick={carregarMais}>Carregar mais chaves</button>}
      </section>
    </>}
  </div>;
}
