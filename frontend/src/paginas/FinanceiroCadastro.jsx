import { useEffect, useState } from 'react';
import api from '../api/api';
import PreviaCobranca from './PreviaCobranca';

const endereco = [
  ['cep', 'CEP', 12], ['logradouro', 'Logradouro', 150], ['numero', 'Número', 20],
  ['complemento', 'Complemento', 120], ['bairro', 'Bairro', 100], ['cidade', 'Cidade', 100], ['uf', 'UF', 2],
];
const base = '/cliente/financeiro';

export function CamposPagador({ dados, alterar, cadastroNovo = false }) {
  const campos = [
    ...(!cadastroNovo ? [['nome', 'Nome ou razão social', 150]] : []),
    ['documento', 'CPF ou CNPJ do pagador', 32], ['email', 'E-mail de cobrança', 200, 'email'],
    ['celular', 'Celular com DDD', 24, 'tel'], ...endereco,
  ];
  return <div className="central-form">
    {campos.map(([campo, rotulo, limite, tipo]) => (
      <label key={campo}>{rotulo}
        <input type={tipo || 'text'} maxLength={limite} value={dados[campo] || ''}
          required={!['complemento', 'celular'].includes(campo) && (!cadastroNovo || !['documento', 'email'].includes(campo))}
          onChange={e => alterar({ ...dados, [campo]: e.target.value })} />
      </label>
    ))}
    {cadastroNovo && <p className="central-full">Se CPF/CNPJ ou e-mail estiver em branco, o sistema usa os dados deste cadastro.</p>}
  </div>;
}

async function enviarArquivo(caminho, arquivo) {
  if (!arquivo || arquivo.size > 4 * 1024 * 1024) throw new Error('Selecione um arquivo de até 4 MB.');
  return api.put(caminho, arquivo, { params: { nome: arquivo.name }, headers: { 'Content-Type': 'application/octet-stream' } });
}

async function baixar(caminho, nome, corpo) {
  const resposta = corpo ? await api.post(caminho, corpo, { responseType: 'blob' })
    : await api.get(caminho, { responseType: 'blob' });
  const url = URL.createObjectURL(resposta.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = nome;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const status = {
  pendente: 'Aguardando cadastro no Asaas',
  pronto: 'Pagador vinculado no Asaas',
  conflito: 'Cadastro exige conferência no Asaas',
  aguardando_conferencia: 'Aguardando confirmação da criação no Asaas',
  dados_rejeitados: 'O Asaas recusou os dados. Confira o cadastro e salve para tentar novamente.',
  conta_alterada: 'Pagador associado a outra conta ou ambiente do Asaas',
};

export default function FinanceiroCadastro({ cliente, voltar }) {
  const caminho = cliente ? `${base}/clientes/${cliente._id}` : `${base}/configuracao`;
  const [dados, setDados] = useState(null);
  const [pagador, setPagador] = useState({});
  const [veiculos, setVeiculos] = useState([]);
  const [token, setToken] = useState('');
  const [ambiente, setAmbiente] = useState('teste');
  const [arquivo, setArquivo] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');

  const carregar = async () => (await api.get(caminho)).data.dados;
  function mostrar(resultado) {
    setDados(resultado);
    if (cliente) setPagador(resultado.dados || { nome: cliente.nome, documento: cliente.cnpj || '' });
    if (resultado.ambiente) setAmbiente(resultado.ambiente);
  }
  useEffect(() => {
    let ativo = true;
    carregar().then(resultado => {
      if (!ativo) return;
      mostrar(resultado);
      setVeiculos(resultado.veiculos?.map(v => v._id) || []);
    }).catch(() => { if (ativo) setErro('Não foi possível carregar o financeiro.'); });
    return () => { ativo = false; };
  }, [caminho]);

  async function executar(acao, mensagem, atualizar = true) {
    setErro('');
    setSucesso('');
    setOcupado(true);
    try {
      await acao();
      if (atualizar) mostrar(await carregar());
      setSucesso(mensagem);
    } catch (e) {
      const resposta = e.response?.data;
      const conteudo = resposta instanceof Blob ? await resposta.text().then(t => JSON.parse(t)).catch(() => ({})) : resposta;
      setErro(conteudo?.mensagem || (e.response ? 'Não foi possível concluir.' : e.message));
    } finally {
      setOcupado(false);
    }
  }

  return <div className="central-page">
    <button type="button" onClick={voltar}>Voltar para clientes</button>
    <h2>{cliente ? `Financeiro e contrato · ${cliente.nome}` : 'Conta de cobrança e modelo de contrato'}</h2>
    {erro && <p role="alert">{erro}</p>}
    {sucesso && <p role="status">{sucesso}</p>}
    {!dados && !erro && <p>Carregando…</p>}
    {dados && !cliente && <>
      <form className="central-card" onSubmit={e => {
        e.preventDefault();
        executar(async () => { await api.put(`${caminho}/asaas`, { token, ambiente }); setToken(''); }, 'Conta Asaas conectada.');
      }}>
        <h3>Asaas da sua empresa</h3>
        {dados.provedor && <p>Conectado em {dados.ambiente === 'teste' ? 'teste' : 'produção'}.</p>}
        <fieldset disabled={ocupado} className="central-form">
          <label>Ambiente<select value={ambiente} onChange={e => setAmbiente(e.target.value)}>
            <option value="teste">Teste</option><option value="producao">Produção</option>
          </select></label>
          <label>Chave da API do Asaas<input type="password" required minLength={12} maxLength={512}
            autoComplete="new-password" value={token} onChange={e => setToken(e.target.value)} /></label>
          <button type="submit">Conectar conta</button>
        </fieldset>
      </form>
      <form className="central-card" onSubmit={e => {
        e.preventDefault();
        executar(() => enviarArquivo(`${caminho}/modelo`, arquivo), 'Modelo Word salvo.');
      }}>
        <h3>Modelo de prestação de serviço</h3>
        {dados.modeloNome && <p>Modelo atual: {dados.modeloNome}</p>}
        <label>Modelo Word (.docx)<input type="file" accept=".docx" required disabled={ocupado} onChange={e => setArquivo(e.target.files[0])} /></label>
        <button disabled={ocupado} type="submit">Salvar modelo</button>
        <details><summary>Campos para inserir no Word</summary><p>Inclua {'{cliente_nome}'}, {'{cliente_cpf_cnpj}'} e {'{lista_veiculos}'}. Copie os demais campos que desejar.</p>
          <ul>{dados.camposContrato?.map(campo => <li key={campo}><code>{`{${campo}}`}</code></li>)}</ul>
        </details>
      </form>
    </>}
    {dados && cliente && <>
      <PreviaCobranca caminho={caminho} />
      <section className="central-card">
        <h3>Cadastro para cobrança</h3>
        <p>{status[dados.estado] || 'Preencha os dados do pagador.'}
          {dados.ambiente ? ` · Ambiente de ${dados.ambiente === 'teste' ? 'teste' : 'produção'}` : ' A conta de cobrança da empresa ainda precisa ser conectada.'}</p>
        <button type="button" disabled={ocupado} onClick={() => executar(async () => mostrar(await carregar()), '', false)}>Atualizar situação</button>
        <form onSubmit={e => {
          e.preventDefault();
          executar(() => api.put(`${caminho}/pagador`, pagador), 'Dados salvos. O cadastro no Asaas segue pela fila de integração.');
        }}>
          <fieldset disabled={ocupado || dados.travado}>
            <CamposPagador dados={pagador} alterar={setPagador} />
            {!dados.travado && <button type="submit">Salvar dados do pagador</button>}
          </fieldset>
        </form>
      </section>
      <section className="central-card">
        <h3>Contrato de prestação de serviço</h3>
        {!dados.modeloNome && <p>Cadastre um modelo Word em Conta de cobrança e modelo de contrato.</p>}
        <fieldset disabled={ocupado || !dados.dados || !dados.modeloNome}>
          <legend>Veículos do contrato</legend>
          {dados.veiculos?.length ? dados.veiculos.map(v => <label key={v._id}>
            <input type="checkbox" checked={veiculos.includes(v._id)} onChange={e => {
              setVeiculos(atual => e.target.checked ? [...atual, v._id] : atual.filter(id => id !== v._id));
            }} />{v.placa} · {v.marca} {v.modelo}
          </label>) : <p>Nenhum veículo cadastrado para este cliente.</p>}
          <button type="button" onClick={() => executar(
            () => baixar(`${caminho}/gerar-contrato`, 'contrato-preenchido.docx', { veiculos }),
            'Contrato preenchido. Revise o arquivo antes de enviar ao cliente.', false,
          )}>Baixar contrato preenchido</button>
        </fieldset>
        <form onSubmit={e => {
          e.preventDefault();
          executar(() => enviarArquivo(`${caminho}/contrato`, arquivo), 'Contrato PDF anexado.');
        }}>
          <label>Anexar contrato final (PDF)<input required type="file" accept=".pdf" disabled={ocupado || !dados.dados}
            onChange={e => setArquivo(e.target.files[0])} /></label>
          <button type="submit" disabled={ocupado || !dados.dados}>Anexar PDF</button>
        </form>
        {dados.contratoNome && <button type="button" disabled={ocupado} onClick={() => executar(
          () => baixar(`${caminho}/contrato`, dados.contratoNome), '', false,
        )}>Baixar PDF anexado</button>}
      </section>
    </>}
  </div>;
}
