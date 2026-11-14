import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../api/api';
import { permite } from '../ajuda/acessos';
import IntegracoesCliente from './IntegracoesCliente';
import FinanceiroCadastro, { CamposPagador } from './FinanceiroCadastro';

const campos = [
  ['nome', 'Nome da empresa', 150],
  ['slug', 'Identificador', 100],
  ['cnpj', 'CNPJ', 32],
];
const dadosAdmin = [['nomeAdmin', 'Nome do administrador', 150, 'text'],
  ['documentoLogin', 'CPF ou CNPJ para entrar', 32, 'text'],
  ['email', 'E-mail de contato', 200, 'email'], ['senha', 'Senha inicial', 72, 'password']];
const novoForm = Object.fromEntries([...campos, ...dadosAdmin].map(([chave]) => [chave, '']));
const ordemAcesso = ['bloqueado', 'consulta', 'configurar'];

export default function Clientes() {
  const { user } = useAuth();
  const [clientes, setClientes] = useState([]);
  const [clienteIntegracao, setClienteIntegracao] = useState(null);
  const [financeiro, setFinanceiro] = useState(null);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState({});
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [permissoes, setPermissoes] = useState(null);
  const [acessosEditados, setAcessosEditados] = useState(false);
  const admin = user?.role === 'admin';
  const central = admin && user?.podeGerenciarEspelhamentos;
  const revenda = admin && user?.podeGerenciarCarteira;
  const administra = central || revenda;
  const podeEditar = admin && permite(user, 'empresa', true);
  const empresaEditada = clientes.find(c => c._id === editando);
  const teto = empresaEditada?.revendedoraId
    ? { ...empresaEditada.revendedoraId.acessos, marca: 'bloqueado' }
    : permissoes?.teto;

  useEffect(() => {
    if (!admin) return;
    let ativo = true;
    api.get('/cliente/cadastros')
      .then(({ data }) => { if (ativo) setClientes(data.dados); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar os clientes.'); });
    return () => { ativo = false; };
  }, [admin, user?.clienteId]);
  useEffect(() => {
    if (!administra) return undefined;
    let ativo = true;
    api.get('/cliente/acessos/opcoes')
      .then(({ data }) => { if (ativo) setPermissoes(data.dados); })
      .catch(() => { if (ativo) setErro('Não foi possível carregar as opções de acesso dos clientes.'); });
    return () => { ativo = false; };
  }, [administra, user?.clienteId]);

  function abrirCadastro(tipo) {
    setEditando('novo');
    setAcessosEditados(false);
    setForm({ ...novoForm, tipo, acessos: { ...permissoes.padrao, ...(tipo === 'revendedora' ? { marca: 'configurar' } : {}) } });
    setErro('');
    setMensagem('');
  }

  async function salvar(e) {
    e.preventDefault();
    setErro('');
    setMensagem('');
    setOcupado(true);
    try {
      const novo = editando === 'novo';
      const { acessos, ...cadastro } = form;
      const { data } = novo ? await api.post('/cliente/cadastros', form)
        : await api.put(`/cliente/${editando}`, acessosEditados ? { ...cadastro, acessos } : cadastro);
      setClientes(atuais => novo ? [...atuais, data.dados].sort((a, b) => a.nome.localeCompare(b.nome))
        : atuais.map(c => c._id === editando ? data.dados :
          c.revendedoraId?._id === editando ? { ...c, revendedoraId: { ...c.revendedoraId, nome: data.dados.nome, acessos: data.dados.acessos } } : c));
      setEditando(null);
      setForm({});
      setMensagem(novo ? 'Empresa e conta de administrador cadastradas.' : 'Cadastro atualizado.');
      if (novo && form.cobranca) setFinanceiro(data.dados);
    } catch (err) {
      setErro(err.response?.data?.mensagem || 'Não foi possível atualizar o cliente.');
    } finally {
      setOcupado(false);
    }
  }

  if (!admin) return <p>A edição de clientes é restrita à administração.</p>;
  if (administra && financeiro) return <FinanceiroCadastro key={financeiro._id || 'configuracao'}
    cliente={financeiro === 'configuracao' ? null : financeiro} voltar={() => setFinanceiro(null)} />;
  if (central && clienteIntegracao) return <IntegracoesCliente key={clienteIntegracao._id}
    cliente={clienteIntegracao} voltar={() => setClienteIntegracao(null)} />;
  return <div className="central-page">
    {administra && <AcoesDaPagina>
    {administra && <button type="button" disabled={ocupado || !permissoes} onClick={() => abrirCadastro('cliente')}>Novo cliente</button>}
    {central && <button type="button" disabled={ocupado || !permissoes} onClick={() => abrirCadastro('revendedora')}>Nova revendedora</button>}
    <button type="button" onClick={() => setFinanceiro('configuracao')}>Conta de cobrança e modelo</button>
    </AcoesDaPagina>}
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {editando && <form onSubmit={salvar} className="central-card">
      <h3>{editando === 'novo' ? (form.tipo === 'revendedora' ? 'Cadastrar revendedora e administrador' : 'Cadastrar cliente e administrador') : 'Editar cadastro'}</h3>
      <fieldset disabled={ocupado} className="central-form">
        {campos.map(([chave, nome, limite]) => <label key={chave}>{nome}
          <input required={chave !== 'cnpj'} maxLength={limite} value={form[chave]}
            onChange={e => setForm(v => ({ ...v, [chave]: e.target.value }))} />
        </label>)}
        {editando === 'novo' && dadosAdmin.map(([chave, nome, limite, tipo]) => <label key={chave}>{nome}
          <input required type={tipo} maxLength={limite} minLength={chave === 'senha' ? 12 : undefined}
            autoComplete={chave === 'senha' ? 'new-password' : undefined} value={form[chave]}
            onChange={e => setForm(v => ({ ...v, [chave]: e.target.value }))} />
        </label>)}
        {administra && editando === 'novo' && <div className="central-full">
          <label><input type="checkbox" checked={Boolean(form.cobranca)} onChange={e => {
            const habilitado = e.target.checked;
            setForm(atual => ({ ...atual, cobranca: habilitado ? {} : undefined }));
          }} /> Preparar cadastro para cobrança e contrato</label>
          {form.cobranca && <CamposPagador cadastroNovo dados={form.cobranca}
            alterar={cobranca => setForm(atual => ({ ...atual, cobranca }))} />}
        </div>}
        {administra && form.acessos && <div className="central-full">
          <h4>{form.tipo === 'revendedora' ? 'Módulos contratados pela revendedora' : 'Acessos do cliente'}</h4>
          <p>Os acessos valem para toda a empresa. {revenda && 'Você pode liberar os módulos disponíveis no seu contrato. '}
            O perfil de cada usuário também define o que ele pode alterar.</p>
          <div className="central-form">
            {permissoes.modulos.map(modulo => <label key={modulo.id}>{modulo.nome}
              <select disabled={modulo.id === 'marca' && form.tipo === 'revendedora'} value={form.acessos[modulo.id] ?? 'bloqueado'} onChange={e => {
                const nivel = e.target.value;
                setAcessosEditados(true);
                setForm(v => ({ ...v, acessos: { ...v.acessos, [modulo.id]: nivel } }));
              }}>
                <option value="bloqueado">Sem acesso</option>
                <option value="consulta" disabled={!ordemAcesso.slice(1).includes(teto?.[modulo.id])}>Somente consulta</option>
                {modulo.edita && <option value="configurar" disabled={teto?.[modulo.id] !== 'configurar'}>Consultar e configurar</option>}
              </select>
            </label>)}
          </div>
        </div>}
        <div className="central-full">
          <button type="submit">Salvar cadastro</button>
          <button type="button" onClick={() => { setEditando(null); setForm({}); }}>Cancelar</button>
        </div>
      </fieldset>
    </form>}
    <section className="central-card central-scroll">
      <table>
        <thead><tr><th>Nome</th><th>Identificador</th><th>CNPJ</th>{central && <th>Tipo e carteira</th>}{(podeEditar || administra) && <th>Ações</th>}</tr></thead>
        <tbody>{clientes.map(c => <tr key={c._id}>
          <td>{c.nome}</td><td>{c.slug}</td><td>{c.cnpj || '—'}</td>
          {central && <td>{c.tipo === 'revendedora' ? 'Revendedora' : c.revendedoraId?.nome || 'Direto'}</td>}
          {(podeEditar || administra) && <td><button type="button" disabled={ocupado || administra && !permissoes} onClick={() => {
            setEditando(c._id);
            setAcessosEditados(false);
            const acessosAtuais = c.acessos ?? {
              ...permissoes?.legado,
              marca: permissoes?.marcasHabilitadas.includes(c._id) ? 'configurar' : 'bloqueado',
            };
            const acessosLimitados = c.revendedoraId && central
              ? Object.fromEntries(permissoes.modulos.map(({ id }) => [id, ordemAcesso[Math.min(
                Math.max(0, ordemAcesso.indexOf(acessosAtuais[id])),
                id === 'marca' ? 0 : Math.max(0, ordemAcesso.indexOf(c.revendedoraId.acessos?.[id])),
              )]]))
              : acessosAtuais;
            setForm({ ...Object.fromEntries(campos.map(([chave]) => [chave, c[chave] || ''])),
              tipo: c.tipo || 'cliente',
              ...(administra && String(c._id) !== String(user.clienteId) ? { acessos: acessosLimitados } : {}),
            });
            setErro('');
            setMensagem('');
          }}>Editar</button>{administra && String(c._id) !== String(user.clienteId) && (!central || !c.revendedoraId) &&
            <button type="button" onClick={() => setFinanceiro(c)}>Financeiro e contrato</button>}
            {central && <> <button type="button" disabled={ocupado}
            aria-label={`Integrações de ${c.nome}`} onClick={() => setClienteIntegracao(c)}>Integrações</button></>}</td>}
        </tr>)}</tbody>
      </table>
    </section>
  </div>;
}
