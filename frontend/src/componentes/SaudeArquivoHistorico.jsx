const nomes = { Localizacao: 'Posições GPS', AmostraTelemetria: 'Telemetria sem GPS' };
const situacoes = { desativado: 'Desativado', disponivel: 'Conectado', indisponivel: 'Indisponível' };
const horario = (valor) => valor ? new Date(valor).toLocaleString('pt-BR') : '—';

export default function SaudeArquivoHistorico({ dados }) {
  if (!dados) return null;
  return (
    <section className="central-card central-scroll" aria-label="Saúde do arquivo de histórico">
      <h3>{situacoes[dados.estado]}</h3>
      <p>Retenção planejada de {dados.diasRetencao} dias, com {dados.diasRecentes} dias de acesso recente. O modo de cópia mantém os registros no banco principal.</p>
      {dados.estado === 'indisponivel' && <p role="status">O arquivo está fora do ar. As consultas dos últimos {dados.diasRecentes} dias continuam disponíveis.</p>}
      {dados.fontes.length > 0 && <table>
        <thead><tr><th>Dados</th><th>Última verificação</th><th>Registro mais antigo no arquivo</th><th>Próxima leitura a conferir</th><th>Recebimentos verificados até</th></tr></thead>
        <tbody>{dados.fontes.map((item) => (
          <tr key={item.fonte}>
            <th scope="row">{nomes[item.fonte]}{item.sincronizando && ' · Verificando'}</th>
            <td>{horario(item.ultimaVerificacao)}</td>
            <td>{horario(item.maisAntigo)}</td>
            <td>{horario(item.pendenteDesde)}</td>
            <td>{horario(item.recebimentoVerificadoAte)}</td>
          </tr>
        ))}</tbody>
      </table>}
    </section>
  );
}
