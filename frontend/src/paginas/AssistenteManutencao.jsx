import { useEffect, useState } from 'react';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
import { permite } from '../ajuda/acessos';
import '../paginas/CentralOperacao.css';
const nomes = {
  em_dia: 'Em dia nos critérios avaliados',
  revisao_programada: 'Revisão programada',
  inspecao_recomendada: 'Inspeção recomendada',
  dados_insuficientes: 'Dados insuficientes',
};
export default function AssistenteManutencao() {
  const { user } = useAuth(),
    gestor = ['admin', 'gestor'].includes(user?.role);
  const [veiculos, setVeiculos] = useState([]),
    [veiculoId, setVeiculoId] = useState(''),
    [analise, setAnalise] = useState(null),
    [config, setConfig] = useState({}),
    [status, setStatus] = useState(null),
    [solicitacoes, setSolicitacoes] = useState([]),
    [erro, setErro] = useState(''),
    [mensagem, setMensagem] = useState(''),
    [ocupado, setOcupado] = useState(false),
    [carregando, setCarregando] = useState(false),
    [decisao, setDecisao] = useState(null),
    [parecer, setParecer] = useState('');
  useEffect(() => {
    if (!gestor) return;
    let ativo = true;
    Promise.all([
      api.get('/operacao/opcoes'),
      api.get('/assistente-manutencao/status'),
      api.get('/assistente-manutencao/solicitacoes'),
    ])
      .then(([v, s, r]) => {
        if (ativo) {
          setVeiculos(v.data.veiculos);
          setVeiculoId(v.data.veiculos[0]?._id || '');
          setStatus(s.data);
          setSolicitacoes(r.data.dados);
        }
      })
      .catch(() => {
        if (ativo)
          setErro(
            'Não foi possível preparar o assistente. Atualize a página para tentar novamente.'
          );
      });
    return () => {
      ativo = false;
    };
  }, [gestor, user?.clienteId]);
  useEffect(() => {
    setAnalise(null);
    setConfig({});
    setDecisao(null);
    setMensagem('');
    if (!gestor || !veiculoId) return;
    let ativo = true;
    setCarregando(true);
    setErro('');
    api
      .get('/assistente-manutencao/' + veiculoId)
      .then((r) => {
        if (ativo) {
          setAnalise(r.data.analise);
          setConfig(r.data.config);
        }
      })
      .catch(() => {
        if (ativo) setErro('Não foi possível consultar a análise anterior.');
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [veiculoId, gestor, user?.clienteId]);
  const atualizarSolicitacoes = async () => {
    const r = await api.get('/assistente-manutencao/solicitacoes');
    setSolicitacoes(r.data.dados);
  };
  async function executar(fn) {
    setOcupado(true);
    setErro('');
    setMensagem('');
    try {
      await fn();
    } catch (e) {
      setErro(
        e.response?.data?.mensagem ||
          'Não foi possível concluir. Atualize a lista antes de repetir uma gravação.'
      );
    } finally {
      setOcupado(false);
    }
  }
  const analisar = () =>
    executar(async () => {
      const r = await api.post(`/assistente-manutencao/${veiculoId}/analisar`);
      setAnalise(r.data.dados);
      setMensagem('Análise técnica concluída com os dados disponíveis.');
    });
  const salvar = (e) => {
    e.preventDefault();
    executar(async () => {
      const dados = {
        ...Object.fromEntries(
          ['temperaturaMotorMax', 'tensaoMinima'].map((k) => [
            k,
            config[k] === '' || config[k] == null ? null : Number(config[k]),
          ])
        ),
        monitorar: config.monitorar === true,
      };
      await api.put(`/assistente-manutencao/${veiculoId}/config`, dados);
      setMensagem('Referências salvas. Execute uma nova análise para aplicá-las.');
    });
  };
  const solicitar = (codigo) =>
    executar(async () => {
      await api.post(`/assistente-manutencao/analises/${analise._id}/solicitacoes`, { codigo });
      await atualizarSolicitacoes();
      setMensagem('Solicitação registrada, aguardando decisão do gestor.');
    });
  const interpretar = () =>
    executar(async () => {
      const r = await api.post(`/assistente-manutencao/analises/${analise._id}/interpretar`);
      setAnalise((a) => ({ ...a, resultado: { ...a.resultado, ia: r.data.dados } }));
    });
  const decidir = (e) => {
    e.preventDefault();
    executar(async () => {
      await api.put(`/assistente-manutencao/solicitacoes/${decisao.id}`, {
        status: decisao.status,
        parecer,
      });
      await atualizarSolicitacoes();
      setDecisao(null);
      setParecer('');
      setMensagem(
        'Decisão registrada. A conclusão não registra automaticamente um serviço de manutenção.'
      );
    });
  };
  if (!gestor)
    return (
      <div>
        <p>As análises e solicitações de inspeção são administradas pelos gestores da empresa.</p>
      </div>
    );
  const resultado = analise?.resultado;
  return (
    <div className="central-page">
      <p>
        Análise de evidências para preparar inspeções. Não prevê uma data de quebra nem autoriza o
        veículo a circular.
      </p>
      <div className="central-card">
        <strong>
          {status?.iaConfigurada
            ? 'Interpretação por IA disponível sob solicitação'
            : 'Análise técnica disponível · interpretação por IA aguardando configuração'}
        </strong>
        <p>
          Consulta leituras dos últimos sete dias, verifica recorrências e cruza revisões com os
          serviços registrados. A IA opcional recebe somente um resumo técnico, sem placa,
          localização ou nomes.
        </p>
      </div>
      <details className="manual-uso">
        <summary>Manual de uso — Manutenção inteligente</summary>
        <div className="manual-uso-conteudo">
          <ol>
            <li>Selecione um veículo próprio. Dados de teste são identificados como simulação.</li>
            <li>
              Defina referências de temperatura do motor e tensão conforme o fabricante e a
              instalação. Deixe em branco se ainda não souber; o critério ficará sem avaliação.
            </li>
            <li>
              Salve as referências e clique em Analisar veículo. A análise fica registrada com data
              e evidências.
            </li>
            <li>
              Leia os dados ausentes e os motivos de cada recomendação. Leituras antigas e poucas
              amostras limitam a análise.
            </li>
            <li>
              Quando houver um achado, registre uma solicitação de inspeção. O gestor poderá
              aprovar, descartar ou concluir com parecer.
            </li>
            <li>
              Após o serviço, registre a manutenção na aba Manutenção. Concluir a solicitação não
              lança custos nem altera o plano.
            </li>
          </ol>
          <p>
            A temperatura do motor tem referência própria; não é o limite de temperatura de carga.
            Três leituras separadas por pelo menos cinco minutos caracterizam recorrência de
            temperatura/tensão; DTC exige duas. Não são consideradas viagens distintas. Em dia
            significa apenas ausência de achados nos critérios e dados avaliados.
          </p>
          <p>
            O monitor automático precisa ser ativado e salvo por veículo. Executa até 50 veículos
            por ciclo de cinco minutos, sem chamadas de IA. A interpretação por IA requer
            configuração do servidor e pode ter custo de uso. Ela não modifica a classificação, não
            cria solicitações e não executa comandos. Revise o texto gerado antes de usá-lo.
          </p>
        </div>
      </details>
      {erro && <p role="alert">{erro}</p>}
      {mensagem && <p role="status">{mensagem}</p>}
      <label>
        Veículo
        <select
          aria-label="Veículo da manutenção inteligente"
          disabled={ocupado}
          value={veiculoId}
          onChange={(e) => setVeiculoId(e.target.value)}
        >
          <option value="">Selecione</option>
          {veiculos.map((v) => (
            <option key={v._id} value={v._id}>
              {v.placa} — {v.marca} {v.modelo}
            </option>
          ))}
        </select>
      </label>
      {!veiculos.length && (
        <p>
          Cadastre um veículo quando estiver disponível. Não é necessário cadastrar dados fictícios.
        </p>
      )}
      {carregando && <p>Consultando análise anterior...</p>}
      {permite(user, 'manutencao', true) && veiculoId && !carregando && (
        <>
          <form className="central-card central-form" onSubmit={salvar}>
            <label>
              Temperatura máxima do motor (°C)
              <input
                type="number"
                aria-label="Temperatura máxima do motor (°C)"
                min="40"
                max="150"
                step="any"
                disabled={ocupado}
                value={config.temperaturaMotorMax ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, temperaturaMotorMax: e.target.value }))}
              />
              <small>Opcional: referência do fabricante, entre 40 e 150 °C.</small>
            </label>
            <label>
              Tensão mínima de referência (V)
              <input
                type="number"
                aria-label="Tensão mínima de referência (V)"
                min="1"
                max="60"
                step="any"
                disabled={ocupado}
                value={config.tensaoMinima ?? ''}
                onChange={(e) => setConfig((c) => ({ ...c, tensaoMinima: e.target.value }))}
              />
              <small>Opcional: conforme o sistema elétrico, entre 1 e 60 V.</small>
            </label>
            <label>
              <input
                type="checkbox"
                disabled={ocupado}
                checked={config.monitorar === true}
                onChange={(e) => setConfig((c) => ({ ...c, monitorar: e.target.checked }))}
              />{' '}
              Monitorar automaticamente sem usar IA externa
            </label>
            <small>
              Verifica em ciclos de cinco minutos e publica novos achados nas notificações internas.
              Salve para ativar ou desativar.
            </small>
            <button disabled={ocupado} type="submit">
              Salvar referências
            </button>
          </form>
          <button disabled={ocupado} onClick={analisar}>
            {ocupado ? 'Processando...' : 'Analisar veículo'}
          </button>
        </>
      )}
      {resultado && (
        <section className="central-card">
          <h3>
            {nomes[resultado.status] || resultado.status}
            {resultado.simulado ? ' · SIMULAÇÃO' : ''}
          </h3>
          <p>
            Análise em {new Date(analise.createdAt).toLocaleString('pt-BR')}. {resultado.quantidade}{' '}
            leituras técnicas. Execute outra análise ou reabra o veículo para consultar a última
            análise do monitor, quando ativado.
          </p>
          <p>{resultado.criterio}</p>
          <details>
            <summary>Etapas executadas</summary>
            <ol>
              {resultado.passos.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </details>
          {resultado.ausencias.length > 0 && (
            <div>
              <h4>Limitações e dados ausentes</h4>
              <ul>
                {resultado.ausencias.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
            </div>
          )}
          {resultado.proximas.length > 0 && (
            <>
              <h4>Próximas revisões por prazo</h4>
              <ul>
                {resultado.proximas.map((p, i) => (
                  <li key={i}>
                    {p.servico}:{' '}
                    {new Date(p.vencimento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                  </li>
                ))}
              </ul>
            </>
          )}
          {!resultado.achados.length && (
            <p>Nenhum achado nos critérios avaliados. Confira as limitações acima.</p>
          )}
          {resultado.achados.map((a) => (
            <article className="central-card" key={a.codigo}>
              <h4>{a.titulo}</h4>
              <p>{a.recomendacao}</p>
              <details>
                <summary>Evidências utilizadas</summary>
                <ul>
                  {a.evidencias.map((e, i) => (
                    <li key={i}>
                      {e.dataHora
                        ? new Date(e.dataHora).toLocaleString('pt-BR')
                        : 'Plano cadastrado'}{' '}
                      · {e.campo}: {String(e.valor)}
                      {e.limite != null ? ` · referência ${e.limite}` : ''}
                      {e.criterio ? ` · critério ${e.criterio.join(' e ')}` : ''}
                      {e.odometroAlvo != null
                        ? ` · revisão aos ${e.odometroAlvo} km, recebido ${e.odometroRecebido ?? 'não disponível'}`
                        : ''}
                    </li>
                  ))}
                </ul>
              </details>
              <button
                disabled={
                  !permite(user, 'manutencao', true) ||
                  ocupado ||
                  solicitacoes.some(
                    (s) => s.aberta && s.codigo === a.codigo && String(s.veiculoId) === veiculoId
                  )
                }
                onClick={() => solicitar(a.codigo)}
              >
                Solicitar inspeção
              </button>
            </article>
          ))}
          <button disabled={ocupado || !status?.iaConfigurada || !permite(user, 'manutencao', true)} onClick={interpretar}>
            Interpretar evidências com IA
          </button>
          {resultado.ia && (
            <aside>
              <h4>Interpretação por IA</h4>
              <p style={{ whiteSpace: 'pre-wrap' }}>{resultado.ia.texto}</p>
              <small>{resultado.ia.aviso}</small>
            </aside>
          )}
        </section>
      )}
      <section className="central-card central-scroll">
        <h3>Solicitações de inspeção</h3>
        <button disabled={ocupado} onClick={() => executar(atualizarSolicitacoes)}>
          Atualizar solicitações
        </button>
        <p>
          Histórico de decisões da empresa. Somente solicitações pendentes podem ser aprovadas;
          somente aprovadas podem ser concluídas.
        </p>
        <table>
          <thead>
            <tr>
              <th>Veículo</th>
              <th>Solicitação</th>
              <th>Situação</th>
              <th>Parecer</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {solicitacoes.map((s) => (
              <tr key={s._id}>
                <td>
                  {veiculos.find((v) => v._id === s.veiculoId)?.placa || 'Veículo indisponível'}
                  {s.simulado ? ' · simulação' : ''}
                </td>
                <td>{s.titulo}</td>
                <td>{s.status}</td>
                <td>
                  {s.parecer || 'Aguardando análise'}
                  {s.historico?.length > 0 && (
                    <details>
                      <summary>Histórico de decisões</summary>
                      <ul>
                        {s.historico.map((h, i) => (
                          <li key={i}>
                            {new Date(h.dataHora).toLocaleString('pt-BR')} · {h.status}: {h.parecer}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                </td>
                <td>
                  {(s.status === 'pendente'
                    ? ['aprovada', 'descartada']
                    : s.status === 'aprovada'
                      ? ['concluida', 'descartada']
                      : []
                  ).map((st) => (
                    <button
                      disabled={ocupado || !permite(user, 'manutencao', true)}
                      key={st}
                      onClick={() => {
                        setDecisao({ id: s._id, status: st });
                        setParecer('');
                      }}
                    >
                      {{ aprovada: 'Aprovar', descartada: 'Descartar', concluida: 'Concluir' }[st]}
                    </button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!solicitacoes.length && <p>Nenhuma solicitação registrada.</p>}
        {decisao && (
          <form onSubmit={decidir}>
            <label>
              Parecer do gestor
              <textarea
                required
                minLength={10}
                maxLength={1000}
                value={parecer}
                onChange={(e) => setParecer(e.target.value)}
              />
            </label>
            <button disabled={ocupado}>Confirmar decisão: {decisao.status}</button>
            <button type="button" disabled={ocupado} onClick={() => setDecisao(null)}>
              Cancelar
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
