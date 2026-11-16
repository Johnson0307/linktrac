import { useEffect, useState } from 'react';
import api from '../api/api';

const rota = '/operacao/chips';
const situacoes = { estoque: 'Em estoque', em_uso: 'Em uso', inativo: 'Inativo' };
const eventos = {
  cadastro: 'Cadastro', vincular: 'Vínculo atualizado', desvincular: 'Retorno ao estoque',
  desativar: 'Desativado', reativar: 'Reativado', troca_veiculo: 'Troca de veículo',
  equipamento_excluido: 'Equipamento excluído', equipamento_transferido: 'Equipamento transferido para outra empresa',
  equipamento_desativado: 'Equipamento desativado',
};
const mensagem = e => e.response?.data?.mensagem || 'Não foi possível concluir a operação do chip.';
const nomeVinculo = v => v && [v.placa, v.equipamento || v.nome].filter(Boolean).join(' · ');
const vazio = { iccid: '', operadora: '' };

export default function EstoqueChips({ podeConfigurar, versao }) {
  const [dados, setDados] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [situacao, setSituacao] = useState('');
  const [carregando, setCarregando] = useState(true);
  const [edicao, setEdicao] = useState(false);
  const [form, setForm] = useState(vazio);
  const [vinculo, setVinculo] = useState(null);
  const [equipamentos, setEquipamentos] = useState([]);
  const [limitado, setLimitado] = useState(false);
  const [destino, setDestino] = useState('');
  const [historico, setHistorico] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [status, setStatus] = useState('');
  const [revisao, setRevisao] = useState(0);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    api.get(rota, { params: { situacao }, timeout: 8000 }).then(({ data }) => {
      if (ativo) { setDados(data.dados); setCursor(data.proximo); }
    }).catch(e => { if (ativo) setErro(mensagem(e)); }).finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [situacao, versao, revisao]);

  async function executar(acao) {
    setOcupado(true);
    setErro('');
    setStatus('');
    try {
      await acao();
    } catch (e) {
      setErro(mensagem(e));
    } finally {
      setOcupado(false);
    }
  }

  function alterar(chip, acao, dispositivoId) {
    executar(async () => {
      await api.patch(`${rota}/${chip._id}`, { acao, dispositivoId, vinculoAtual: chip.dispositivoId || null });
      setVinculo(null);
      setHistorico(null);
      setStatus('Situação do chip atualizada.');
      setRevisao(v => v + 1);
    });
  }

  function mostrarHistorico(chip, antes) {
    executar(async () => {
      const { data } = await api.get(`${rota}/${chip._id}/historico`, { params: { antes } });
      setHistorico(anterior => ({ chip, dados: antes ? [...anterior.dados, ...data.dados] : data.dados, cursor: data.proximo }));
    });
  }

  return <section className="central-card central-scroll" aria-label="Estoque de chips">
    {erro && <p role="alert">{erro}</p>}
    {status && <p role="status">{status}</p>}
    <label>Situação <select value={situacao} disabled={ocupado} onChange={e => {
      setSituacao(e.target.value); setDados([]); setCursor(null);
    }}>
      <option value="">Todas</option>
      {Object.entries(situacoes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {podeConfigurar && <button type="button" disabled={ocupado} aria-expanded={edicao} onClick={() => setEdicao(v => !v)}>Novo chip</button>}
    {edicao && <form onSubmit={e => {
      e.preventDefault();
      executar(async () => {
        await api.post(rota, form);
        setEdicao(false);
        setForm(vazio);
        setSituacao('estoque');
        setStatus('Chip cadastrado no estoque.');
        setRevisao(v => v + 1);
      });
    }}>
      <fieldset disabled={ocupado} className="central-form">
        <label>ICCID<input inputMode="numeric" pattern="[0-9]{18,22}" maxLength={22} required value={form.iccid}
          onChange={e => setForm(v => ({ ...v, iccid: e.target.value }))} /></label>
        <label>Operadora<input maxLength={80} required value={form.operadora}
          onChange={e => setForm(v => ({ ...v, operadora: e.target.value }))} /></label>
        <button type="submit">Salvar chip</button>
      </fieldset>
    </form>}
    {carregando && <p role="status">Atualizando estoque…</p>}
    {!carregando && dados.length === 0 && !erro && <p>Nenhum chip encontrado.</p>}
    {dados.length > 0 && <table>
      <thead><tr><th>ICCID</th><th>Operadora</th><th>Situação</th><th>Veículo e equipamento</th><th>Ações</th></tr></thead>
      <tbody>{dados.map(chip => <tr key={chip._id}>
        <td>{chip.iccid}</td><td>{chip.operadora}</td><td>{situacoes[chip.situacao]}</td><td>{nomeVinculo(chip.vinculo) || '—'}</td>
        <td>
          <button type="button" disabled={ocupado} onClick={() => mostrarHistorico(chip)}>Histórico</button>
          {podeConfigurar && chip.ativo && <button type="button" disabled={ocupado} onClick={() => executar(async () => {
            const { data } = await api.get(`${rota}/equipamentos`);
            setEquipamentos(data.dados); setLimitado(data.limitado); setVinculo(chip); setDestino(chip.dispositivoId || '');
          })}>{chip.dispositivoId ? 'Trocar equipamento' : 'Vincular'}</button>}
          {podeConfigurar && chip.dispositivoId && <button type="button" disabled={ocupado} onClick={() => alterar(chip, 'desvincular')}>Voltar ao estoque</button>}
          {podeConfigurar && <button type="button" disabled={ocupado}
            onClick={() => alterar(chip, chip.ativo ? 'desativar' : 'reativar')}>{chip.ativo ? 'Desativar' : 'Reativar'}</button>}
        </td>
      </tr>)}</tbody>
    </table>}
    {cursor && <button type="button" disabled={ocupado || carregando} onClick={() => executar(async () => {
      const { data } = await api.get(rota, { params: { situacao, antes: cursor } });
      setDados(v => [...v, ...data.dados]); setCursor(data.proximo);
    })}>Carregar mais chips</button>}
    {vinculo && <form onSubmit={e => { e.preventDefault(); alterar(vinculo, 'vincular', destino); }}>
      <h3>Equipamento para o chip {vinculo.iccid}</h3>
      <label>Veículo e equipamento<select required value={destino} disabled={ocupado} onChange={e => setDestino(e.target.value)}>
        <option value="">Selecione</option>
        {equipamentos.map(v => <option key={v.dispositivoId} value={v.dispositivoId}>{nomeVinculo(v)}</option>)}
      </select></label>
      {limitado && <p>Exibindo até 500 equipamentos.</p>}
      <button type="submit" disabled={ocupado || !destino}>Salvar vínculo</button>
      <button type="button" disabled={ocupado} onClick={() => setVinculo(null)}>Cancelar</button>
    </form>}
    {historico && <section>
      <h3>Histórico do chip {historico.chip.iccid}</h3>
      <button type="button" disabled={ocupado} onClick={() => setHistorico(null)}>Fechar histórico</button>
      <ol>{historico.dados.map(item => <li key={item._id}>
        {new Date(item.createdAt).toLocaleString('pt-BR')} · {eventos[item.tipo]} · {item.usuario}
        {item.origem && <p>Origem {nomeVinculo(item.origem)}</p>}
        {item.destino && <p>Destino {nomeVinculo(item.destino)}</p>}
      </li>)}</ol>
      {historico.cursor && <button type="button" disabled={ocupado} onClick={() => mostrarHistorico(historico.chip, historico.cursor)}>Carregar histórico anterior</button>}
    </section>}
  </section>;
}
