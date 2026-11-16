import { useEffect, useState } from 'react';
import api from '../api/api';

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const dinheiro = centavos => moeda.format(centavos / 100);
const comoReal = centavos => (centavos / 100).toFixed(2).replace('.', ',');
const competencia = mes => new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  .format(new Date(`${mes}-01T00:00:00Z`));
const modalidades = ['telemetria', 'telemetria_completa'];

function emCentavos(texto) {
  if (!/^\d{1,5}(?:[,.]\d{1,2})?$/.test(texto.trim())) {
    throw new Error('Informe os preços em reais, com até duas casas decimais.');
  }
  const [real, fracao = ''] = texto.trim().split(/[,.]/);
  return Number(real) * 100 + Number(fracao.padEnd(2, '0'));
}

function Tabela({ titulo, calculo }) {
  if (!calculo) return null;
  return <table>
    <caption>{titulo}</caption>
    <thead><tr><th>Função</th><th>Veículos</th><th>Valor por veículo</th><th>Subtotal</th></tr></thead>
    <tbody>{calculo.itens.map(item => <tr key={item.id}>
      <th scope="row">{item.nome}</th><td>{item.quantidade}</td>
      <td>{dinheiro(item.valorUnitarioCentavos)}</td><td>{dinheiro(item.subtotalCentavos)}</td>
    </tr>)}</tbody>
    <tfoot><tr><th scope="row" colSpan={3}>Total estimado</th><td><strong>{dinheiro(calculo.totalCentavos)}</strong></td></tr></tfoot>
  </table>;
}

export default function PreviaCobranca({ caminho }) {
  const [dados, setDados] = useState(null);
  const [valores, setValores] = useState({ rastreamento: '' });
  const [adicionais, setAdicionais] = useState('0');
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState('');
  const [erro, setErro] = useState('');
  const [tentativa, setTentativa] = useState(0);
  const preencherPlano = plano => setValores(plano
    ? Object.fromEntries(Object.entries(plano).map(([chave, centavos]) => [chave, comoReal(centavos)]))
    : { rastreamento: '' });

  useEffect(() => {
    let ativo = true;
    api.get(`${caminho}/previa`, { timeout: 8000 }).then(({ data }) => {
      if (!ativo) return;
      setDados(data.dados);
      preencherPlano(data.dados.valores);
    }).catch(e => {
      if (ativo) setErro(e.response?.data?.mensagem || 'Não foi possível carregar a prévia.');
    });
    return () => { ativo = false; };
  }, [caminho, tentativa]);

  function editar(proximos) {
    setValores(proximos);
    setDados(atual => ({ ...atual, simulacao: null }));
    setMensagem('');
  }

  async function processar(simular) {
    setErro('');
    setMensagem('');
    setOcupado(true);
    try {
      const plano = Object.fromEntries(Object.entries(valores).map(([chave, valor]) => [chave, emCentavos(valor)]));
      if (simular && !/^\d{1,5}$/.test(adicionais)) throw new Error('Informe a quantidade de veículos para simular.');
      const resposta = simular ? await api.post(`${caminho}/previa`, { valores: plano, adicionais: Number(adicionais) }, { timeout: 8000 })
        : await api.put(`${caminho}/plano`, { valores: plano }, { timeout: 8000 });
      setDados(resposta.data.dados);
      setMensagem(simular ? 'Simulação calculada.' : 'Valores do plano salvos.');
    } catch (e) {
      setErro(e.response?.data?.mensagem || (e.response ? 'Não foi possível calcular a prévia.' : e.message));
    } finally {
      setOcupado(false);
    }
  }

  const modalidade = modalidades.find(id => Object.hasOwn(valores, id)) || '';
  const campoValor = (id, nome) => <label>{nome} por veículo (R$)
    <input inputMode="decimal" maxLength={8} value={valores[id]} required
      onChange={e => editar({ ...valores, [id]: e.target.value })} />
  </label>;

  return <section className="central-card central-scroll">
    <h3>Prévia da cobrança mensal</h3>
    {erro && <p role="alert">{erro}</p>}
    {mensagem && <p role="status">{mensagem}</p>}
    {!dados && (erro ? <button type="button" onClick={() => { setErro(''); setTentativa(v => v + 1); }}>Tentar novamente</button> : <p>Carregando prévia…</p>)}
    {dados && <>
      <p><strong>{competencia(dados.competencia)}</strong> · {dados.quantidade} veículos ativos
        {dados.incluiCarteira && ' da revendedora e dos clientes ativos da carteira'}.</p>
      <p>As funções do plano valem para toda a frota contabilizada. A prévia usa os veículos ativos na data da consulta.</p>
      <Tabela titulo="Prévia com o plano salvo" calculo={dados.previa} />
      <form onSubmit={e => { e.preventDefault(); processar(e.nativeEvent.submitter?.value === 'simular'); }}>
        <fieldset className="central-form" disabled={ocupado}>
          <legend>Valores e funções do plano</legend>
          {campoValor('rastreamento', dados.funcoes.rastreamento)}
          <label>Modalidade de telemetria<select value={modalidade} onChange={e => {
            const proximos = { ...valores };
            for (const id of modalidades) delete proximos[id];
            if (e.target.value) proximos[e.target.value] = valores[e.target.value] ?? '';
            editar(proximos);
          }}>
            <option value="">Sem telemetria no plano</option>
            {modalidades.map(id => <option value={id} key={id}>{dados.funcoes[id]}</option>)}
          </select></label>
          {modalidade && campoValor(modalidade, dados.funcoes[modalidade])}
          {Object.entries(dados.funcoes).filter(([id]) => id !== 'rastreamento' && !modalidades.includes(id)).map(([id, nome]) => <div key={id}>
            <label><input type="checkbox" checked={Object.hasOwn(valores, id)} onChange={e => {
              const proximos = { ...valores };
              if (e.target.checked) proximos[id] = '';
              else delete proximos[id];
              editar(proximos);
            }} />{nome}</label>
            {Object.hasOwn(valores, id) && campoValor(id, nome)}
          </div>)}
          <div className="central-full">
            <button type="submit" value="salvar">Salvar plano</button>
          </div>
          <label>Veículos adicionais para simular
            <input inputMode="numeric" maxLength={5} value={adicionais} onChange={e => {
              setAdicionais(e.target.value); setDados(atual => ({ ...atual, simulacao: null }));
            }} />
          </label>
          <button type="submit" value="simular">Simular cobrança</button>
        </fieldset>
      </form>
      <Tabela titulo="Simulação · valores e veículos estimados" calculo={dados.simulacao} />
    </>}
  </section>;
}
