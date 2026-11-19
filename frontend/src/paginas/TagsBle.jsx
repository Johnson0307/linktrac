import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import MapaTrajeto from '../componentes/MapaTrajeto';
import './CentralOperacao.css';

const vazio = {
  nome: '', bem: '', fabricante: '', modelo: '', formato: 'mac', identificador: '',
  receptorId: '', firmwareTag: '', firmwareReceptor: '', status: 'a_testar', observacao: '', ativo: true,
};
const estados = {
  a_testar: 'A testar', em_teste: 'Em teste',
  homologada: 'Homologada pelo gestor', incompativel: 'Incompatível no teste',
};
const formatos = { mac: 'MAC Bluetooth', ibeacon: 'iBeacon', eddystone: 'Eddystone UID' };
const orientacoes = {
  mac: 'Use o MAC com 12 dígitos, como AABBCCDDEEFF.',
  ibeacon: 'Use UUID:major:minor, como 00112233445566778899aabbccddeeff:1:2.',
  eddystone: 'Junte Namespace e Instance em 32 dígitos hexadecimais.',
};
const horario = data => data ? new Date(data).toLocaleString('pt-BR') : 'Sem detecção recebida';
const mensagem = erro => erro.response?.data?.mensagem || 'Não foi possível concluir a operação das tags BLE.';

export default function TagsBle() {
  const { user } = useAuth();
  const podeConfigurar = ['admin', 'gestor'].includes(user?.role) && permite(user, 'equipamentos', true);
  const podeConsultar = ['admin', 'gestor'].includes(user?.role) && permite(user, 'equipamentos');
  const [lista, setLista] = useState({ dados: [], receptores: [], catalogo: [] });
  const [form, setForm] = useState(vazio);
  const [editando, setEditando] = useState(null);
  const [modelo, setModelo] = useState('');
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [revisao, setRevisao] = useState(0);
  const [detalhe, setDetalhe] = useState(null);
  const [historico, setHistorico] = useState(null);

  useEffect(() => {
    setLista({ dados: [], receptores: [], catalogo: [] }); setForm(vazio);
    setEditando(null); setModelo(''); setDetalhe(null); setHistorico(null);
    setErro(''); setSucesso('');
  }, [user?.clienteId]);

  useEffect(() => {
    if (!podeConsultar) return;
    const controle = new AbortController();
    setCarregando(true);
    api.get('/operacao/tags-ble', { signal: controle.signal })
      .then(({ data }) => { if (!controle.signal.aborted) { setLista(data); setErro(''); } })
      .catch(e => { if (!controle.signal.aborted) setErro(mensagem(e)); })
      .finally(() => { if (!controle.signal.aborted) setCarregando(false); });
    return () => controle.abort();
  }, [user?.clienteId, revisao, podeConsultar]);

  const alterar = campo => e => setForm(f => ({
    ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
  }));
  const limpar = () => { setForm(vazio); setEditando(null); setModelo(''); };

  async function salvar(e) {
    e.preventDefault();
    setOcupado(true); setErro(''); setSucesso('');
    try {
      if (editando) await api.put('/operacao/tags-ble/' + editando, form);
      else await api.post('/operacao/tags-ble', form);
      limpar(); setHistorico(null); setDetalhe(null);
      setSucesso('Cadastro e resultado da homologação registrados.');
      setRevisao(v => v + 1);
    } catch (e) { setErro(mensagem(e)); }
    finally { setOcupado(false); }
  }
  function editar(tag) {
    setForm(Object.fromEntries(Object.keys(vazio).map(campo => [campo, tag[campo] ?? vazio[campo]])));
    setEditando(tag._id); setModelo(''); setSucesso(''); setErro('');
    document.getElementById('cadastro-tag-ble')?.scrollIntoView({ block: 'start' });
  }
  async function consultarHistorico(tag) {
    setErro(''); setOcupado(true);
    try {
      const { data } = await api.get('/operacao/tags-ble/' + tag._id + '/historico');
      setHistorico({ nome: tag.nome, eventos: data.dados });
      setDetalhe(null);
    } catch (e) { setErro(mensagem(e)); }
    finally { setOcupado(false); }
  }
  const fonte = lista.catalogo[Number(modelo)]?.fonte;
  if (!podeConsultar) return <p>O acesso às tags BLE é administrado pela sua empresa.</p>;
  return <div className="central-page">
    <AcoesDaPagina>
      <button disabled={carregando || ocupado} onClick={() => setRevisao(v => v + 1)}>Atualizar tags</button>
    </AcoesDaPagina>
    {erro && <p role="alert" className="central-error">{erro}</p>}
    {sucesso && <p role="status" className="central-success">{sucesso}</p>}
    {carregando && <p role="status">Carregando tags...</p>}
    <p>A tag é localizada quando um receptor Bluetooth compatível detecta seu sinal.
      O mapa mostra a posição do receptor no momento da detecção.</p>
    {podeConfigurar && <form id="cadastro-tag-ble" className="central-card" onSubmit={salvar}>
      <h3>{editando ? 'Editar tag e homologação' : 'Cadastrar tag BLE'}</h3>
      <fieldset className="central-form" disabled={ocupado}>
        <label className="central-full">Modelo de referência
          <select value={modelo} onChange={e => {
            setModelo(e.target.value);
            const item = lista.catalogo[Number(e.target.value)];
            if (e.target.value && item) setForm(f => ({
              ...f, fabricante: item.fabricante, modelo: item.modelo, formato: item.formatos[0],
            }));
          }}>
            <option value="">Preencher manualmente ou escolher um modelo</option>
            {lista.catalogo.map((item, i) => <option key={item.fabricante + item.modelo} value={i}>
              {item.fabricante} {item.modelo}
            </option>)}
          </select>
        </label>
        {modelo !== '' && fonte && <p className="central-full">
          <a href={fonte} target="_blank" rel="noreferrer">Documentação do fabricante</a>.
          Confirme a compatibilidade com o receptor e o firmware no teste.
        </p>}
        {[['nome', 'Nome da tag', 100], ['bem', 'Bem, máquina ou equipamento identificado', 150],
          ['fabricante', 'Fabricante', 100], ['modelo', 'Modelo', 100]].map(([campo, label, maxLength]) =>
          <label key={campo}>{label}<input required={['nome', 'bem'].includes(campo)}
            maxLength={maxLength} value={form[campo]} onChange={alterar(campo)} /></label>)}
        <label>Tipo de identificador
          <select value={form.formato} onChange={alterar('formato')}>
            {Object.entries(formatos).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
        <label>Identificador da tag<input required maxLength={100}
          value={form.identificador} onChange={alterar('identificador')} /></label>
        <p className="central-full">{orientacoes[form.formato]}</p>
        <label>Receptor Bluetooth
          <select value={form.receptorId} onChange={alterar('receptorId')}>
            <option value="">Qualquer receptor da empresa</option>
            {lista.receptores.map(r => <option key={r._id} value={r._id}>
              {r.nome} · {[r.fabricante, r.modelo].filter(Boolean).join(' ')}
            </option>)}
            {form.receptorId && !lista.receptores.some(r => r._id === form.receptorId) &&
              <option value={form.receptorId}>Receptor desativado — selecione outro</option>}
          </select>
        </label>
        <label>Situação da homologação
          <select value={form.status} onChange={alterar('status')}>
            {Object.entries(estados).map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
          </select>
        </label>
        <details className="central-full">
          <summary>Dados do teste de homologação</summary>
          <div className="central-form">
            <label>Firmware da tag<input maxLength={100} value={form.firmwareTag} onChange={alterar('firmwareTag')} /></label>
            <label>Firmware do receptor<input maxLength={100} value={form.firmwareReceptor} onChange={alterar('firmwareReceptor')} /></label>
            <label className="central-full">Resultado e observações do teste
              <textarea maxLength={1000} value={form.observacao} onChange={alterar('observacao')} />
            </label>
          </div>
          <p>Registre a leitura do identificador, alcance observado, posição, bateria e sensores testados.
            A homologação registra a avaliação do gestor para a combinação de tag e receptor.</p>
        </details>
        <label><input type="checkbox" checked={form.ativo} onChange={alterar('ativo')} /> Tag ativa</label>
        <div className="central-full">
          <button type="submit">{ocupado ? 'Salvando...' : 'Salvar tag'}</button>
          {editando && <button type="button" onClick={limpar}>Cancelar edição</button>}
        </div>
      </fieldset>
    </form>}
    <section className="central-card central-scroll" aria-label="Tags BLE cadastradas">
      <h3>Tags cadastradas</h3>
      {!carregando && !lista.dados.length && <p>Nenhuma tag cadastrada.</p>}
      <table>
        <thead><tr><th>Tag e bem</th><th>Homologação</th><th>Última detecção</th><th>Ações</th></tr></thead>
        <tbody>{lista.dados.map(tag => <tr key={tag._id}>
          <td><strong>{tag.nome}</strong><br />{tag.bem}<br />
            {[tag.fabricante, tag.modelo].filter(Boolean).join(' ')}<br />
            <small>{formatos[tag.formato]} · {tag.identificador}{!tag.ativo && ' · Desativada'}</small>
          </td>
          <td>{estados[tag.status]}</td>
          <td>{horario(tag.ultimaDeteccao?.dataHora)}
            {Number.isFinite(tag.ultimaDeteccao?.rssi) && <><br />{tag.ultimaDeteccao.rssi} dBm</>}
            {Number.isFinite(tag.ultimaDeteccao?.bateriaV) && <><br />{tag.ultimaDeteccao.bateriaV} V</>}
            {tag.ultimaDeteccao?.bateriaBaixa && <><br />Bateria baixa</>}
          </td>
          <td>{podeConfigurar && <button disabled={ocupado} onClick={() => editar(tag)}>Editar</button>}
            <button disabled={ocupado} onClick={() => consultarHistorico(tag)}>Histórico</button>
            {tag.ultimaDeteccao && <button onClick={() => { setDetalhe(tag); setHistorico(null); }}>Ver detecção</button>}
          </td>
        </tr>)}</tbody>
      </table>
      {lista.limitado && <p>Exibindo as 500 tags mais recentes.</p>}
    </section>
    {detalhe && <section className="central-card">
      <h3>{detalhe.nome} · Última detecção</h3>
      <p>{horario(detalhe.ultimaDeteccao.dataHora)} · Receptor {
        lista.receptores.find(r => r._id === detalhe.ultimaDeteccao.receptorId)?.nome || 'registrado no histórico'
      }</p>
      {Number.isFinite(detalhe.ultimaDeteccao.temperaturaC) && <p>Temperatura {detalhe.ultimaDeteccao.temperaturaC} °C</p>}
      {Number.isFinite(detalhe.ultimaDeteccao.latitude) && Number.isFinite(detalhe.ultimaDeteccao.longitude)
        ? <><p>Posição aproximada do receptor no momento da detecção Bluetooth.</p>
          <MapaTrajeto posicoes={[{ ...detalhe.ultimaDeteccao, legenda: 'Receptor Bluetooth' }]} /></>
        : <p>Esta detecção chegou sem coordenadas GPS do receptor.</p>}
      <button onClick={() => setDetalhe(null)}>Fechar detecção</button>
    </section>}
    {historico && <section className="central-card central-scroll">
      <h3>Histórico · {historico.nome}</h3>
      <table><thead><tr><th>Data e hora</th><th>Responsável</th><th>Situação</th><th>Resultado do teste</th></tr></thead>
        <tbody>{historico.eventos.map(e => <tr key={e._id}>
          <td>{horario(e.createdAt)}</td><td>{e.por}</td><td>{estados[e.cadastro.status]}</td>
          <td>{e.cadastro.observacao || '—'}</td>
        </tr>)}</tbody>
      </table>
      <p>Últimos 100 registros de cadastro e homologação.</p>
      <button onClick={() => setHistorico(null)}>Fechar histórico</button>
    </section>}
  </div>;
}
