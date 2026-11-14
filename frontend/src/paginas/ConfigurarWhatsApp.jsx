import { useEffect, useState } from 'react';
import api from '../api/api';

const caminho = '/operacao/configuracoes/whatsapp';
const estados = {
  sem_numero: 'Cadastre o número comercial que vai enviar os avisos.',
  pendente: 'Número salvo. Falta conectar a conta comercial no servidor e validar o número.',
  validado: 'Número confirmado na Meta.',
};

export default function ConfigurarWhatsApp() {
  const [aberto, setAberto] = useState(false);
  const [registro, setRegistro] = useState(null);
  const [numero, setNumero] = useState('');
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    setRegistro(null);
    setErro('');
    api.get(caminho).then(({ data }) => {
      if (!ativo) return;
      setRegistro(data.dados);
      setNumero(data.dados.numero ? `+${data.dados.numero}` : '');
    }).catch(e => {
      if (ativo) setErro(e.response?.data?.mensagem || 'Não foi possível consultar o número.');
    });
    return () => { ativo = false; };
  }, [aberto]);

  async function salvar(e) {
    e.preventDefault();
    setSalvando(true);
    setErro('');
    try {
      const { data } = await api.put(caminho, { numero });
      setRegistro(data.dados);
      setNumero(`+${data.dados.numero}`);
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Não foi possível salvar o número.');
    } finally {
      setSalvando(false);
    }
  }

  return <section className="central-card">
    <button type="button" aria-expanded={aberto} disabled={salvando} onClick={() => setAberto(v => !v)}>
      WhatsApp Business
    </button>
    {aberto && <>
      {erro && <p role="alert">{erro}</p>}
      {!registro && !erro && <p role="status">Carregando…</p>}
      {registro && <form onSubmit={salvar}>
        <label>Número do WhatsApp Business com DDD
          <input type="tel" autoComplete="tel" maxLength={24} required value={numero}
            disabled={salvando} onChange={e => setNumero(e.target.value)} />
        </label>
        <button type="submit" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar número'}</button>
        <p role="status">{estados[registro.estado]}</p>
      </form>}
    </>}
  </section>;
}
