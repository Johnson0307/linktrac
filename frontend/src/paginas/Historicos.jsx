import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import ManualUso from '../componentes/ManualUso';
const vazio = { servico: '', dataServico: '', custo: '', quilometragem: '', proximaData: '', proximaQuilometragem: '' };
const dataHora = (v) => new Date(v).toLocaleString('pt-BR');
const data = (v) => v ? new Date(v).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—';
const area = (recurso) => recurso?.includes('/motoristas') ? 'Motoristas' : recurso?.includes('/manutencoes') ? 'Manutenção' : recurso?.includes('/espelhamentos') ? 'Espelhamentos' : recurso?.includes('/usuarios') ? 'Usuários' : recurso?.includes('/veiculos') ? 'Veículos' : recurso?.includes('/auth') ? 'Acesso ao sistema' : 'Empresa';
const operacao = (l) => l.recurso?.endsWith('/auth/login') ? 'Entrada no sistema' : ({ POST: 'Cadastro', PUT: 'Alteração', PATCH: 'Alteração', DELETE: 'Revogação' }[l.metodo] || 'Operação');
export default function Historicos({ inicial = 'alertas' }) {
  const { user } = useAuth();
  const gestor = ['admin', 'gestor'].includes(user?.role);
  const [veiculos, setVeiculos] = useState([]);
  const [veiculo, setVeiculo] = useState('');
  const rastreamento = permite(user, 'rastreamento');
  const manutencao = permite(user, 'manutencao');
  const auditoria = gestor && permite(user, 'usuarios');
  const abas = [
    ...(rastreamento ? [['alertas', 'Alertas'], ['ignicao', 'Ignição']] : []),
    ...(manutencao ? [['manutencoes', 'Manutenção']] : []),
    ...(auditoria ? [['acoes', 'Ações dos usuários']] : []),
  ];
  const [abaSelecionada, setAba] = useState(inicial);
  const aba = abas.some(([id]) => id === abaSelecionada) ? abaSelecionada : abas[0]?.[0];
  const caminhoVeiculos = user?.acessos == null ? '/veiculos' : '/veiculos/opcoes';
  const [resultado, setResultado] = useState(null);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [carregando, setCarregando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [versao, setVersao] = useState(0);
  const [form, setForm] = useState(vazio);
  useEffect(() => { setAba(inicial); }, [inicial]);
  useEffect(() => {
    let ativo = true;
    if (!rastreamento && !manutencao) return;
    api.get(caminhoVeiculos).then(({ data: b }) => {
      if (ativo) { setVeiculos(b.dados || []); setVeiculo((b.dados || [])[0]?._id || ''); }
    }).catch((e) => { if (ativo) setErro(e.response?.data?.mensagem || 'Não foi possível carregar os veículos.'); });
    return () => { ativo = false; };
  }, [rastreamento, manutencao, caminhoVeiculos]);
  useEffect(() => {
    let ativo = true;
    setResultado(null); setErro(''); setSucesso('');
    if (!aba || (aba !== 'acoes' && !veiculo)) { setCarregando(false); return undefined; }
    setCarregando(true);
    const caminho = aba === 'acoes' ? '/historicos/acoes' : `/historicos/${encodeURIComponent(veiculo)}/${aba === 'manutencoes' ? 'manutencoes' : 'eventos'}`;
    api.get(caminho).then(({ data: b }) => { if (ativo) setResultado(b); })
      .catch((e) => { if (ativo) setErro(e.response?.data?.mensagem || 'Não foi possível consultar o histórico.'); })
      .finally(() => { if (ativo) setCarregando(false); });
    return () => { ativo = false; };
  }, [aba, veiculo, versao, gestor]);
  const selecionado = veiculos.find((v) => v._id === veiculo);
  const proprietario = selecionado && String(selecionado.clienteId?._id || selecionado.clienteId) === String(user?.clienteId);
  const registrar = async (e) => {
    e.preventDefault(); setSalvando(true); setErro(''); setSucesso('');
    try {
      const r = await api.post(`/historicos/${encodeURIComponent(veiculo)}/manutencoes`, {
        servico: form.servico, dataServico: form.dataServico, custoCentavos: Math.round(Number(form.custo) * 100),
        quilometragem: Number(form.quilometragem), proximaData: form.proximaData || undefined,
        proximaQuilometragem: form.proximaQuilometragem === '' ? undefined : Number(form.proximaQuilometragem),
      });
      const nova = r.data.dados;
      setResultado((old) => ({ ...old, dados: [nova, ...(old?.dados || [])].sort((a, b) => new Date(b.dataServico) - new Date(a.dataServico)).slice(0, 500) }));
      setForm(vazio);
      setSucesso(r.headers?.['x-linktrac-auditoria'] ? 'Manutenção salva. O registro de auditoria ficou indisponível.' : 'Manutenção registrada com sucesso.');
    } catch (err) { setErro(err.response?.data?.mensagem || 'Não foi possível salvar a manutenção.'); }
    finally { setSalvando(false); }
  };
  if (!aba) return <p>Nenhum histórico disponível para esta conta.</p>;
  const linhas = resultado ? (aba === 'alertas' ? resultado.alertas : aba === 'ignicao' ? resultado.ignicao : resultado.dados) || [] : [];
  return <main style={{ padding: '2rem', maxWidth: 1200, margin: 'auto' }}>
    <AcoesDaPagina>
      <select aria-label="Tipo de histórico" value={aba} disabled={salvando} onChange={e => setAba(e.target.value)}>
        {abas.map(([valor, nome]) => <option key={valor} value={valor}>{nome}</option>)}
      </select>
      <button type="button" disabled={carregando || salvando} onClick={() => setVersao(v => v + 1)}>Atualizar histórico</button>
    </AcoesDaPagina>
    <ManualUso secao={`historicos.${aba}`} />
    {aba !== 'acoes' && <label>Veículo <select aria-label="Veículo do histórico" value={veiculo} disabled={salvando} onChange={(e) => { setVeiculo(e.target.value); setForm(vazio); }}>
      {!veiculos.length && <option value="">Nenhum veículo cadastrado</option>}
      {veiculos.map((v) => <option key={v._id} value={v._id}>{v.placa} — {v.marca} {v.modelo}</option>)}
    </select></label>}
    {selecionado?.marca === 'TESTE' && selecionado?.modelo === 'SIMULACAO' && aba !== 'acoes' && <p><strong>Veículo de SIMULAÇÃO. Não representa um veículo real.</strong></p>}
    {rastreamento && selecionado && aba !== 'acoes' && <p><Link to={`/rastreamento?placa=${encodeURIComponent(selecionado.placa)}&veiculoId=${veiculo}`}>Ver posições, viagens, paradas e trajeto</Link></p>}
    {aba === 'alertas' && <p>Alertas calculados sobre até 500 posições recentes: velocidade acima de 80 km/h e intervalos sem comunicação acima de 5 minutos. Não enviam notificações. Posições antigas podem indicar equipamento desligado ou teste encerrado.</p>}
    {aba === 'ignicao' && <p>Estados e mudanças recebidos do equipamento. Não inferimos ignição pela velocidade. Posições antigas sem esse campo não geram registros de ignição.</p>}
    {aba === 'acoes' && <p>Últimas 500 operações bem-sucedidas e logins registrados a partir da ativação da auditoria. Não registra senhas, tokens ou conteúdo dos formulários. Alterações diretas no banco e scripts locais não aparecem aqui.</p>}
    {aba === 'manutencoes' && gestor && proprietario && permite(user, 'manutencao', true) && <form onSubmit={registrar} style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '1rem', background: '#fff', margin: '1rem 0' }}>
      <h3 style={{ width: '100%' }}>Registrar serviço realizado</h3>
      {[['servico', 'Serviço', 'text'], ['dataServico', 'Data do serviço', 'date'], ['custo', 'Custo (R$)', 'number'], ['quilometragem', 'Quilometragem (km)', 'number'], ['proximaData', 'Próxima revisão em (opcional)', 'date'], ['proximaQuilometragem', 'Próxima revisão aos km (opcional)', 'number']].map(([chave, nome, tipo]) =>
        <label key={chave}>{nome}<input style={{ display: 'block' }} aria-label={nome} type={tipo} maxLength={chave === 'servico' ? 200 : undefined} min={tipo === 'number' ? 0 : undefined} step={chave === 'custo' ? '0.01' : tipo === 'number' ? '1' : undefined} required={!chave.startsWith('proxima')} value={form[chave]} onChange={(e) => setForm((f) => ({ ...f, [chave]: e.target.value }))} /></label>)}
      <button disabled={salvando} type="submit">{salvando ? 'Salvando...' : 'Registrar manutenção'}</button>
    </form>}
    {erro && <p role="alert" style={{ color: '#B91C1C' }}>{erro}</p>}
    {sucesso && <p role="status">{sucesso}</p>}
    {carregando && <p>Carregando histórico...</p>}
    {resultado?.limitado && <p>Exibindo somente os 500 registros ou posições mais recentes; o histórico pode ser parcial.</p>}
    {resultado && !linhas.length && <p>Nenhum registro disponível para este histórico.</p>}
    {resultado && linhas.length > 0 && <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', textAlign: 'left', background: '#fff' }}>
      <thead><tr>{(aba === 'alertas' ? ['Data e hora', 'Alerta', 'Detalhe', 'Origem'] : aba === 'ignicao' ? ['Data e hora', 'Ignição', 'Registro', 'Origem'] : aba === 'acoes' ? ['Data e hora', 'Usuário', 'Operação', 'Área'] : ['Data', 'Serviço', 'Custo', 'km', 'Próxima revisão', 'Próximos km']).map((c) => <th key={c}>{c}</th>)}</tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={l._id || i} style={{ borderBottom: '1px solid #ddd' }}>
        {aba === 'alertas' ? <><td>{dataHora(l.dataHora)}</td><td>{l.tipo}</td><td>{l.detalhe}</td><td>{l.simulado ? 'Simulado' : 'Telemetria'}</td></> :
          aba === 'ignicao' ? <><td>{dataHora(l.dataHora)}</td><td>{l.ligada ? 'Ligada' : 'Desligada'}</td><td>{l.tipo}</td><td>{l.simulado ? 'Simulado' : 'Dispositivo'}</td></> :
          aba === 'acoes' ? <><td>{dataHora(l.dataHora)}</td><td>{l.usuario}</td><td>{operacao(l)}</td><td>{area(l.recurso)}</td></> :
          <><td>{data(l.dataServico)}</td><td>{l.servico}</td><td>{(l.custoCentavos / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td><td>{l.quilometragem}</td><td>{data(l.proximaData)}</td><td>{l.proximaQuilometragem ?? '—'}</td></>}
      </tr>)}</tbody>
    </table></div>}
  </main>;
}
