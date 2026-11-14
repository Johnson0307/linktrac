import { useEffect, useRef, useState } from 'react';
import api from '../api/api';
import { gerarId, Linhas } from './RotaTrocasConteiner';

const horario = valor => new Date(valor).toLocaleString('pt-BR');

async function prepararFoto(arquivo) {
  if (!arquivo || !arquivo.type.startsWith('image/') || arquivo.size > 15 * 1024 * 1024) {
    throw new Error('Selecione uma imagem de até 15 MB.');
  }
  const url = URL.createObjectURL(arquivo);
  try {
    const imagem = new Image();
    imagem.src = url;
    await imagem.decode();
    const escala = Math.min(1, 1280 / Math.max(imagem.naturalWidth, imagem.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(imagem.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imagem.naturalHeight * escala));
    const contexto = canvas.getContext('2d', { alpha: false });
    contexto.fillStyle = '#fff';
    contexto.fillRect(0, 0, canvas.width, canvas.height);
    contexto.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    for (const qualidade of [0.82, 0.65, 0.48, 0.32]) {
      const base64 = canvas.toDataURL('image/jpeg', qualidade).split(',')[1];
      if (base64 && Math.floor(base64.length * 3 / 4) <= 350 * 1024) return base64;
    }
    throw new Error('A foto ficou grande. Tire outra com menos detalhes.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function FormExecucaoEntrega({ parada, tipo, ocupado, salvar, cancelar }) {
  const [recebedor, setRecebedor] = useState('');
  const [observacao, setObservacao] = useState('');
  const [motivo, setMotivo] = useState('');
  const [tentativaId] = useState(gerarId);
  const [movimentos, setMovimentos] = useState(parada.dados.movimentosConteiner);
  const [arquivo, setArquivo] = useState(null);
  const [erro, setErro] = useState('');
  const [preparando, setPreparando] = useState(false);
  const titulo = useRef(null);
  const tentativa = tipo === 'tentativa';
  useEffect(() => { titulo.current?.focus(); }, []);

  async function enviar(e) {
    e.preventDefault();
    setErro('');
    setPreparando(true);
    try {
      if (tentativa) await salvar({ motivo: motivo.trim(), tentativaId });
      else {
        const foto = arquivo ? await prepararFoto(arquivo) : undefined;
        await salvar({ recebedor, observacao, movimentos, foto });
      }
    } catch (e) {
      setErro(e.message || 'Não foi possível preparar a foto.');
    } finally {
      setPreparando(false);
    }
  }

  return <form className="central-card" onSubmit={enviar}>
    <h3 ref={titulo} tabIndex={-1}>{tentativa ? 'Registrar tentativa sem sucesso' : 'Concluir com comprovante'}</h3>
    <p>{parada.dados.destinatario} · {parada.dados.endereco}</p>
    {erro && <p role="alert">{erro}</p>}
    <fieldset className="central-form" disabled={ocupado || preparando}>
      {tentativa ? <label>Motivo da tentativa
        <textarea required maxLength={300} value={motivo} onChange={e => setMotivo(e.target.value)} />
      </label> : <>
        <label>Quem recebeu (opcional)
          <input maxLength={120} value={recebedor} onChange={e => setRecebedor(e.target.value)} />
        </label>
        <label>Observação (opcional)
          <textarea maxLength={500} value={observacao} onChange={e => setObservacao(e.target.value)} />
        </label>
        <label>Foto do comprovante (opcional)
          <input type="file" accept="image/*" onChange={e => setArquivo(e.target.files?.[0] || null)} />
        </label>
        {movimentos && <div className="central-full">
          <h4>Movimentações realizadas</h4>
          <p>Confira os movimentos e corrija os que foram diferentes do planejado.</p>
          <Linhas lista={movimentos} alterar={setMovimentos} />
        </div>}
      </>}
      <div className="central-full">
        <button type="submit" disabled={tentativa && !motivo.trim()}>{preparando ? 'Salvando...' : tentativa ? 'Salvar tentativa' : 'Salvar conclusão'}</button>{' '}
        <button type="button" onClick={cancelar}>Cancelar</button>
      </div>
    </fieldset>
  </form>;
}

export function RegistroExecucao({ parada }) {
  const [erro, setErro] = useState('');
  const [baixando, setBaixando] = useState(false);
  const { dados } = parada;
  const comprovante = dados.comprovante;
  if (!dados.chegouEm && !dados.concluidaEm && !dados.tentativas?.length) return null;

  async function baixarFoto() {
    setErro('');
    setBaixando(true);
    try {
      const { data } = await api.get(`/tms/paradas/${parada._id}/foto`, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'comprovante-entrega.jpg';
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setErro('Não foi possível baixar a foto.');
    } finally {
      setBaixando(false);
    }
  }

  return <details>
    <summary>Registro da entrega</summary>
    {dados.chegouEm && <p>Chegada registrada em {horario(dados.chegouEm)}</p>}
    {dados.concluidaEm && <p>Concluída em {horario(dados.concluidaEm)}</p>}
    {comprovante?.recebedor && <p>Recebedor: {comprovante.recebedor}</p>}
    {comprovante?.observacao && <p>{comprovante.observacao}</p>}
    {dados.tentativas?.length > 0 && <ul>{dados.tentativas.map((t, i) =>
      <li key={t.id || i}>{horario(t.dataHora)} · {t.motivo}</li>)}</ul>}
    {comprovante?.temFoto && <button type="button" onClick={baixarFoto} disabled={baixando}>Baixar foto</button>}
    {erro && <p role="alert">{erro}</p>}
  </details>;
}

export function HistoricoEntregas({ veiculoId, revisao }) {
  const [aberto, setAberto] = useState(false);
  const [resposta, setResposta] = useState(null);
  const [erro, setErro] = useState('');
  useEffect(() => {
    if (!aberto) return;
    let ativo = true;
    api.get('/tms/paradas', { params: { veiculoId, situacao: 'historico' } })
      .then(({ data }) => { if (ativo) { setResposta(data); setErro(''); } })
      .catch(() => { if (ativo) setErro('Não foi possível consultar o histórico de entregas.'); });
    return () => { ativo = false; };
  }, [veiculoId, aberto, revisao]);
  return <details className="central-card" onToggle={e => setAberto(e.currentTarget.open)}>
    <summary>Histórico de entregas e comprovantes</summary>
    {erro && <p role="alert">{erro}</p>}
    {aberto && !resposta && !erro && <p>Carregando histórico...</p>}
    {resposta?.dados.length === 0 && <p>Nenhuma entrega encerrada para este veículo.</p>}
    {resposta?.dados.map(p => <article key={p._id}>
      <h4>{p.dados.destinatario} · {p.dados.status === 'entregue' ? 'Concluída' : 'Cancelada'}</h4>
      <p>{p.dados.codigo} · {p.dados.endereco}</p>
      <RegistroExecucao parada={p} />
    </article>)}
    {resposta?.limitado && <p>Exibindo as 200 entregas encerradas mais recentes.</p>}
  </details>;
}
