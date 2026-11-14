import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';

export default function Espelhamentos() {
  const { user } = useAuth();
  const [dados, setDados] = useState({ veiculos: [], empresas: [] });
  const [veiculoId, setVeiculoId] = useState('');
  const [clienteId, setClienteId] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const [mensagem, setMensagem] = useState('');
  const carregar = async () => {
    const resposta = await api.get('/espelhamentos');
    setDados(resposta.data.dados);
  };
  useEffect(() => {
    if (user?.podeGerenciarEspelhamentos)
      carregar().catch(() => setErro('Não foi possível carregar as empresas e veículos.'));
  }, [user?.podeGerenciarEspelhamentos]);
  const alterar = async (destino, revogar = false) => {
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      const url = `/espelhamentos/${encodeURIComponent(veiculoId)}/clientes/${encodeURIComponent(destino)}`;
      const resposta = revogar ? await api.delete(url) : await api.put(url);
      await carregar();
      setMensagem(resposta.data.mensagem);
      setClienteId('');
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Não foi possível atualizar o espelhamento.');
    } finally {
      setOcupado(false);
    }
  };
  if (!user?.podeGerenciarEspelhamentos)
    return <p style={{ padding: '2rem' }}>Acesso exclusivo à administração Linktrac.</p>;
  const veiculo = dados.veiculos.find((v) => v._id === veiculoId);
  const vinculados = veiculo?.clientesEspelhados || [];
  return (
    <div style={{ padding: '2rem', maxWidth: '900px', margin: 'auto' }}>
      <p>
        Autorize outra empresa a consultar o veículo e seu rastreamento. A propriedade e o histórico
        permanecem na empresa de origem.
      </p>
      {erro && <p role="alert">{erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          alterar(clienteId);
        }}
        style={{ display: 'grid', gap: '1rem' }}
      >
        <label>
          Veículo de origem{' '}
          <select
            required
            value={veiculoId}
            disabled={ocupado}
            onChange={(e) => {
              setVeiculoId(e.target.value);
              setClienteId('');
              setMensagem('');
            }}
          >
            <option value="">Selecione o veículo e a proprietária</option>
            {dados.veiculos.map((v) => (
              <option key={v._id} value={v._id}>
                {v.placa} — {v.clienteId?.nome || 'Empresa não encontrada'}
              </option>
            ))}
          </select>
        </label>
        <label>
          Empresa que receberá acesso{' '}
          <select
            required
            disabled={!veiculo || ocupado}
            value={clienteId}
            onChange={(e) => setClienteId(e.target.value)}
          >
            <option value="">Selecione a empresa</option>
            {dados.empresas
              .filter(
                (c) =>
                  c._id !== veiculo?.clienteId?._id && !vinculados.some((v) => v?._id === c._id)
              )
              .map((c) => (
                <option key={c._id} value={c._id}>
                  {c.nome}
                </option>
              ))}
          </select>
        </label>
        <button disabled={ocupado || !veiculoId || !clienteId}>Autorizar espelhamento</button>
      </form>
      {veiculo && (
        <>
          <h3>Empresas autorizadas</h3>
          {vinculados.length ? (
            <ul>
              {vinculados.filter(Boolean).map((c) => (
                <li key={c._id}>
                  {c.nome}{' '}
                  <button disabled={ocupado} onClick={() => alterar(c._id, true)}>
                    Revogar acesso
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>Nenhuma empresa autorizada.</p>
          )}
        </>
      )}
    </div>
  );
}
