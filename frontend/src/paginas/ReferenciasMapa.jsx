import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import SeletorIconeMapa, { PreviaIconeMapa } from '../componentes/SeletorIconeMapa';
import CoordenadasEntrega, { ponto } from './CoordenadasEntrega';
import './CentralOperacao.css';

const caminho = '/veiculos/mapa/referencias';
const vazio = { nome: '', latitude: '', longitude: '', iconeMapa: { tipo: 'referencia' } };
const mensagem = e => e.response?.data?.mensagem || 'Não foi possível acessar os pontos de referência.';

export default function ReferenciasMapa({ podeEditar, podeVerMapa }) {
  const [locais, setLocais] = useState(null);
  const [form, setForm] = useState(null);
  const [erro, setErro] = useState('');
  const [aviso, setAviso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [lendo, setLendo] = useState(false);

  useEffect(() => {
    const controle = new AbortController();
    api.get(caminho, { signal: controle.signal })
      .then(({ data }) => { if (!controle.signal.aborted) setLocais(data.dados); })
      .catch(e => { if (!controle.signal.aborted) setErro(mensagem(e)); });
    return () => controle.abort();
  }, []);

  function abrir(valor) {
    setForm(valor);
    setAviso('');
    setErro('');
  }

  async function salvar(e) {
    e.preventDefault();
    const coordenadas = ponto(form);
    if (!coordenadas || lendo || ocupado) return;
    setOcupado(true);
    setErro('');
    try {
      const payload = { nome: form.nome.trim(), ...coordenadas, iconeMapa: form.iconeMapa };
      const { data: { dados } } = form._id ? await api.put(`${caminho}/${form._id}`, payload) : await api.post(caminho, payload);
      setLocais(atuais => [...(atuais || []).filter(item => item._id !== dados._id), dados].sort((a, b) => a.nome.localeCompare(b.nome)));
      setForm(null);
      setAviso('Ponto salvo no Mapa Geral.');
    } catch (e) { setErro(mensagem(e)); }
    finally { setOcupado(false); }
  }

  async function excluir(local) {
    if (!window.confirm(`Excluir o ponto “${local.nome}” do mapa?`)) return;
    setOcupado(true);
    setErro('');
    try {
      await api.delete(`${caminho}/${local._id}`);
      setLocais(atuais => atuais.filter(item => item._id !== local._id));
      if (form?._id === local._id) setForm(null);
      setAviso('Ponto removido do mapa.');
    } catch (e) { setErro(mensagem(e)); }
    finally { setOcupado(false); }
  }

  return <section className="central-card" style={{ marginTop: 24 }}>
    <div className="central-heading">
      <h3>Pontos de referência</h3>
      {podeEditar && <button type="button" disabled={ocupado || lendo || Boolean(form)} onClick={() => abrir(vazio)}>Adicionar ponto de referência</button>}
    </div>
    {erro && <p role="alert">{erro}</p>}
    {aviso && <p role="status">{aviso}</p>}
    {form && <form onSubmit={salvar}>
      <fieldset disabled={ocupado} className="central-form">
        <legend>{form._id ? 'Editar ponto' : 'Novo ponto de referência'}</legend>
        <label className="central-full">Nome do local
          <input placeholder="Minha casa, empresa, igreja…" value={form.nome} maxLength={100} required
            onChange={e => setForm(v => ({ ...v, nome: e.target.value }))} />
        </label>
        <CoordenadasEntrega valor={form} alterar={dados => setForm(v => ({ ...v, ...dados }))} tipoPonto="de referência" />
        <SeletorIconeMapa grupo="lugar" valor={form.iconeMapa} bloquear={setLendo} alterar={iconeMapa => setForm(v => ({ ...v, iconeMapa }))} />
        <div className="central-full">
          <button type="submit" disabled={lendo || !form.nome.trim() || !ponto(form)}>Salvar ponto</button>{' '}
          <button type="button" disabled={lendo} onClick={() => abrir(null)}>Cancelar ponto</button>
        </div>
      </fieldset>
    </form>}
    {!locais && !erro && <p role="status">Consultando pontos…</p>}
    {locais?.length === 0 && <p>Nenhum ponto de referência cadastrado.</p>}
    {!!locais?.length && <div className="central-scroll"><table>
      <thead><tr><th>Local</th>{(podeVerMapa || podeEditar) && <th>Ações</th>}</tr></thead>
      <tbody>{locais.map(local => <tr key={local._id}>
        <td><PreviaIconeMapa icone={local.iconeMapa} padrao="referencia" /> {local.nome}</td>
        {(podeVerMapa || podeEditar) && <td>
          {podeVerMapa && <Link to={`/mapa?referencia=${encodeURIComponent(local._id)}`}>Ver no mapa</Link>}{' '}
          {podeEditar && <>
            <button type="button" disabled={ocupado || lendo || Boolean(form)} onClick={() => abrir(local)}>Editar ponto</button>{' '}
            <button type="button" disabled={ocupado || lendo || Boolean(form)} onClick={() => excluir(local)}>Excluir ponto</button>
          </>}
        </td>}
      </tr>)}</tbody>
    </table></div>}
  </section>;
}
