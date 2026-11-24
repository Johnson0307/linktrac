import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';

export default function LembretePonto() {
  const { user } = useAuth();
  const habilitado = user?.role === 'motorista' && permite(user, 'operacao');
  const [aviso, setAviso] = useState(null), [erro, setErro] = useState(''), [ocupado, setOcupado] = useState(false);
  useEffect(() => {
    setAviso(null); setErro('');
    if (!habilitado) return;
    const controle = new AbortController();
    let pendente = false;
    async function consultar() {
      if (pendente) return;
      pendente = true;
      try {
        const { data } = await api.get('/jornada/meus-lembretes', { signal: controle.signal });
        if (!controle.signal.aborted) { setAviso(data.dados[0] || null); setErro(''); }
      } catch {
        if (!controle.signal.aborted) setAviso(null);
      } finally { pendente = false; }
    }
    consultar();
    const timer = setInterval(consultar, 30000);
    return () => { controle.abort(); clearInterval(timer); };
  }, [habilitado, user?.id, user?._id, user?.clienteId, user?.email]);
  async function dispensar() {
    setOcupado(true); setErro('');
    try { await api.post(`/jornada/meus-lembretes/${aviso._id}/dispensar`, {}); setAviso(null); }
    catch { setErro('Não foi possível dispensar o lembrete. Tente novamente.'); }
    finally { setOcupado(false); }
  }
  if (!habilitado || !aviso) return null;
  return <aside className="central-card" aria-label="Lembrete de ponto" role="status">
    <strong>Confira seu ponto</strong>
    <p>{aviso.mensagem}</p>
    <p>Este aviso não registra ponto. Faça a marcação no aplicativo do seu fornecedor, com o veículo parado.</p>
    {aviso.pontoUrl === 'https://app.tangerino.com.br/Tangerino/' && <p><a href={aviso.pontoUrl} target="_blank" rel="noopener noreferrer">Abrir Sólides Ponto</a></p>}
    <button type="button" disabled={ocupado} onClick={dispensar}>Dispensar lembrete</button>
    {erro && <p role="alert">{erro}</p>}
  </aside>;
}
