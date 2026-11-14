import { useState } from 'react';
import api from '../api/api';

const horario = valor => new Date(valor).toLocaleString('pt-BR');
const km = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RelatorioTrajeto({ veiculoId, inicio, fim }) {
  const [circuito, setCircuito] = useState('');
  const [resultado, setResultado] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState('');
  const chave = JSON.stringify([veiculoId, inicio, fim, circuito]);
  const atual = resultado?.chave === chave ? resultado : null;

  async function consultar(e) {
    e.preventDefault();
    setOcupado(true);
    setErro('');
    setResultado(null);
    try {
      const filtros = { veiculoId, inicio: new Date(inicio).toISOString(), fim: new Date(fim).toISOString(), circuito };
      const { data } = await api.post('/relatorios/trajeto', filtros);
      setResultado({ dados: data.dados, filtros, chave });
    } catch (e) {
      setErro(e.response?.data?.mensagem || 'Confira o veículo e o período selecionados.');
    } finally {
      setOcupado(false);
    }
  }

  async function baixar() {
    setOcupado(true);
    setErro('');
    try {
      const { data } = await api.post('/relatorios/trajeto/kml', atual.filtros, { responseType: 'blob' });
      const url = URL.createObjectURL(data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `linktrac-trajeto-${atual.dados.placa.replace(/[^A-Za-z0-9-]/g, '')}.kml`;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      const resposta = e.response?.data;
      const corpo = resposta instanceof Blob ? await resposta.text().then(JSON.parse).catch(() => null) : resposta;
      setErro(corpo?.mensagem || 'Não foi possível baixar o KML.');
    } finally {
      setOcupado(false);
    }
  }

  const dados = atual?.dados;
  return <section className="central-card">
    <h3>Quilometragem e trajeto GPS</h3>
    <p>Usa o veículo e o período selecionados acima. Para exportar um circuito, informe o horário de início e fim dele.</p>
    <form className="central-form" onSubmit={consultar}>
      <label>Referência do circuito (opcional)
        <input value={circuito} onChange={e => setCircuito(e.target.value)} maxLength={100} />
      </label>
      <div className="central-full">
        <button type="submit" disabled={ocupado || !veiculoId || !inicio || !fim}>Calcular quilometragem</button>{' '}
        {dados?.trechos > 0 && <button type="button" disabled={ocupado} onClick={baixar}>Baixar trajeto KML</button>}
      </div>
    </form>
    {erro && <p role="alert">{erro}</p>}
    {dados && <div aria-live="polite">
      <h4>{dados.placa}{dados.circuito && ` · ${dados.circuito}`}</h4>
      <p>{horario(dados.inicio)} a {horario(dados.fim)}</p>
      {dados.distanciaKm === null
        ? <p>Posições consecutivas insuficientes para calcular a distância.</p>
        : <p><strong>{km.format(dados.distanciaKm)} km estimados por GPS</strong> em {dados.trechos} {dados.trechos === 1 ? 'trecho' : 'trechos'}.</p>}
      <p>Posições válidas: {dados.pontosValidos}. Leituras descartadas: {dados.descartados}. Interrupções entre trechos: {dados.interrupcoes}.</p>
      {dados.primeiro && <p>Primeiro ponto em {horario(dados.primeiro)}. Último ponto em {horario(dados.ultimo)}.</p>}
      <p>A estimativa soma os segmentos entre posições reais consecutivas. Lacunas acima de 5 minutos e saltos incompatíveis com a velocidade do veículo ficam de fora.</p>
    </div>}
  </section>;
}
