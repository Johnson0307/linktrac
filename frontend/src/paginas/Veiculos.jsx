import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import { atualizarVeiculo, cadastrarVeiculo, listarTodos } from '../api/veiculos';
import SeletorIconeMapa, { PreviaIconeMapa } from '../componentes/SeletorIconeMapa';
import ReferenciasMapa from './ReferenciasMapa';

const formInicial = {
  placa: '',
  marca: '',
  modelo: '',
  ano: '',
  cor: '',
  nomeCliente: '',
  telefone: '',
  alertaAlimentacaoWhatsApp: false,
  ativo: true,
  iconeMapa: null,
};

const Veiculos = () => {
  const { user } = useAuth();
  const podeCadastrar = ['admin', 'gestor'].includes(user?.role) && permite(user, 'veiculos', true);
  const [veiculos, setVeiculos] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [editando, setEditando] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [lendoIcone, setLendoIcone] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');

  useEffect(() => {
    const carregarVeiculos = async () => {
      try {
        const resposta = await listarTodos();
        setVeiculos(resposta.dados || []);
      } catch (err) {
        console.error('Erro ao carregar veículos:', err);
        setErro('Não foi possível carregar os veículos.');
      }
    };

    carregarVeiculos();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
      ...(name === 'telefone' ? { alertaAlimentacaoWhatsApp: false } : {}),
    }));
  };

  const editar = (veiculo) => {
    setForm(Object.fromEntries(Object.entries(formInicial).map(([campo, padrao]) =>
      [campo, veiculo[campo] ?? padrao]
    )));
    setEditando(veiculo._id || veiculo.id);
    setErro('');
    setMensagem('');
    document.getElementById('form-veiculo')?.scrollIntoView({ block: 'start' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (lendoIcone || carregando) return;
    setErro('');
    setMensagem('');
    setCarregando(true);

    try {
      const resposta = editando ? await atualizarVeiculo(editando, form) : await cadastrarVeiculo(form);
      const veiculo = resposta.dados;
      setVeiculos((prev) => editando
        ? prev.map((item) => (item._id || item.id) === editando ? veiculo : item)
        : [veiculo, ...prev]);
      setMensagem(editando ? 'Veículo atualizado com sucesso.' : 'Veículo cadastrado com sucesso.');
      setForm(formInicial);
      setEditando(null);
    } catch (err) {
      setErro(err?.mensagem || (err?.erros ? err.erros.join(' ') : 'Erro ao salvar veículo.'));
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

      {podeCadastrar && (
        <div
          style={{
            background: '#F8FAFC',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '2rem',
          }}
        >
          <h3 style={{ marginBottom: '1rem', color: '#334155' }}>{editando ? 'Editar veículo' : 'Cadastrar novo veículo'}</h3>
          <form
            id="form-veiculo"
            onSubmit={handleSubmit}
            style={{
              display: 'grid',
              gap: '1rem',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            }}
          >
            {erro && <p style={{ color: '#DC2626' }}>{erro}</p>}
            {mensagem && <p style={{ color: '#16A34A' }}>{mensagem}</p>}
            <input
              type="text"
              name="placa"
              placeholder="Placa"
              value={form.placa}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, placa: e.target.value.toUpperCase() }))
              }
              required
              style={inputStyle}
            />
            <input
              type="text"
              name="marca"
              placeholder="Marca"
              value={form.marca}
              onChange={handleChange}
              required
              style={inputStyle}
            />
            <input
              type="text"
              name="modelo"
              placeholder="Modelo"
              value={form.modelo}
              onChange={handleChange}
              required
              style={inputStyle}
            />
            <input
              type="number"
              name="ano"
              placeholder="Ano"
              value={form.ano}
              onChange={handleChange}
              required
              style={inputStyle}
            />
            <input
              type="text"
              name="cor"
              placeholder="Cor"
              value={form.cor}
              onChange={handleChange}
              style={inputStyle}
            />
            <input
              type="text"
              name="nomeCliente"
              placeholder="Nome do cliente"
              value={form.nomeCliente}
              onChange={handleChange}
              required
              style={inputStyle}
            />
            <input
              type="tel"
              name="telefone"
              placeholder="Telefone"
              value={form.telefone}
              onChange={handleChange}
              style={inputStyle}
            />
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" name="alertaAlimentacaoWhatsApp" checked={form.alertaAlimentacaoWhatsApp === true} onChange={handleChange} />
              O cliente autorizou receber alertas de perda de alimentação neste WhatsApp
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <input type="checkbox" name="ativo" checked={form.ativo} onChange={handleChange} />
              Ativo
            </label>

            <SeletorIconeMapa key={editando || 'novo'} valor={form.iconeMapa} bloquear={setLendoIcone}
              alterar={iconeMapa => setForm(v => ({ ...v, iconeMapa }))} />
            <button type="submit" style={buttonStyle} disabled={carregando || lendoIcone}>
              {carregando ? 'Salvando...' : editando ? 'Salvar veículo' : 'Cadastrar veículo'}
            </button>
            {editando && <button type="button" disabled={carregando || lendoIcone}
              onClick={() => { setEditando(null); setForm(formInicial); }}>Cancelar edição</button>}
          </form>
        </div>
      )}

      <div>
        <h3 style={{ marginBottom: '1rem', color: '#334155' }}>Veículos Cadastrados</h3>
        {veiculos.length === 0 ? (
          <p style={{ color: '#64748B' }}>Nenhum veículo cadastrado ainda.</p>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            {veiculos.map((v) => (
              <div
                key={v._id || v.id || v.placa}
                style={{
                  padding: '1rem',
                  background: '#FFFFFF',
                  borderRadius: '6px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                }}
              >
                <PreviaIconeMapa icone={v.iconeMapa} /> <strong>{v.placa}</strong> — {v.marca} {v.modelo} ({v.ano})
                {String(v.clienteId) !== String(user?.clienteId) && (
                  <span> — Espelhado (consulta)</span>
                )}
                <br />
                Cliente: {v.nomeCliente || 'Não informado'}
                <br />
                {v.telefone && (
                  <>
                    Telefone: {v.telefone} <br />
                  </>
                )}
                <span style={{ color: v.ativo ? '#047857' : '#B91C1C' }}>
                  {v.ativo ? 'Ativo' : 'Inativo'}
                </span>
                <br />
                <Link
                  to={`/rastreamento?placa=${encodeURIComponent(v.placa)}&veiculoId=${encodeURIComponent(v._id || v.id)}`}
                >
                  Consultar rastreamento
                </Link>
                {podeCadastrar && String(v.clienteId) === String(user?.clienteId) && <> <button type="button"
                  disabled={carregando || lendoIcone} onClick={() => editar(v)}>Editar veículo</button></>}
              </div>
            ))}
          </div>
        )}
      </div>
      <ReferenciasMapa podeEditar={podeCadastrar} podeVerMapa={permite(user, 'rastreamento')} />
    </div>
  );
};

const inputStyle = {
  padding: '0.6rem',
  border: '1px solid #CBD5E1',
  borderRadius: '4px',
  fontSize: '1rem',
};

const buttonStyle = {
  padding: '0.6rem',
  backgroundColor: '#0099FF',
  color: '#FFFFFF',
  border: 'none',
  borderRadius: '4px',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '500',
};

export default Veiculos;
