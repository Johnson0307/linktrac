import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { obterUltimaPosicao } from '../api/rastreamento';
import HistoricoRastreamento from '../componentes/HistoricoRastreamento';
import MapaTrajeto from '../componentes/MapaTrajeto';
import TelemetriaVeiculo from '../componentes/TelemetriaVeiculo';
import { obterConfiguracoes } from '../api/configuracoes';

const Rastreamento = () => {
  const [searchParams] = useSearchParams();
  const [placa, setPlaca] = useState(() => (searchParams.get('placa') || '').trim().toUpperCase());
  const [carregando, setCarregando] = useState(false);
  const [resultado, setResultado] = useState(null);
  const { latitude, longitude, dataHora, velocidade } = resultado?.localizacao || {};
  const ultimaPosicao = useMemo(() => [{ latitude, longitude, dataHora, velocidade, legenda: 'Última posição' }],
    [latitude, longitude, dataHora, velocidade]);
  const [erro, setErro] = useState('');
  const [automatico, setAutomatico] = useState(false);
  const consultaEmCurso = useRef(false);
  const versaoConsulta = useRef(0);
  const veiculoId = searchParams.get('veiculoId');
  const [intervalo, setIntervalo] = useState(5);
  useEffect(() => {
    let ativo = true;
    obterConfiguracoes().then((c) => { if (ativo && Number.isFinite(c.intervaloAtualizacao)) setIntervalo(c.intervaloAtualizacao); }).catch(() => {});
    return () => { ativo = false; };
  }, []);

  const consultarVeiculo = useCallback(async (event) => {
    event?.preventDefault?.();
    if (consultaEmCurso.current) return;
    const placaTrim = placa.trim();
    if (!placaTrim) {
      setErro('Digite a placa do veículo.');
      setResultado(null);
      return;
    }

    consultaEmCurso.current = true;
    const versao = versaoConsulta.current;
    setCarregando(true);
    setErro('');

    try {
      // backend retorna: { sucesso, veiculo, localizacao }
      const resposta = await obterUltimaPosicao(placaTrim, veiculoId);
      if (versao !== versaoConsulta.current) return;
      setResultado(resposta);
    } catch (fetchError) {
      if (versao !== versaoConsulta.current) return;
      setErro(
        fetchError?.mensagem ||
          fetchError?.response?.data?.mensagem ||
          'Não foi possível consultar a posição.'
      );
    } finally {
      consultaEmCurso.current = false;
      setCarregando(false);
    }
  }, [placa, veiculoId]);

  useEffect(() => {
    if (!automatico || !placa.trim()) return undefined;
    consultarVeiculo();
    const timer = setInterval(consultarVeiculo, intervalo * 1000);
    return () => clearInterval(timer);
  }, [automatico, placa, consultarVeiculo, intervalo]);

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>

      <AcoesDaPagina>
      <form
        onSubmit={consultarVeiculo}
      >
        <input
          aria-label="Placa do veículo"
          type="text"
          placeholder="Digite a placa"
          value={placa}
          onChange={(e) => {
            versaoConsulta.current += 1;
            setAutomatico(false);
            setResultado(null);
            setPlaca(e.target.value.toUpperCase());
          }}
        />
        <button
          type="submit"
          disabled={carregando}
        >
          {carregando ? 'Buscando...' : 'Consultar'}
        </button>
        <label>
          <input type="checkbox" checked={automatico} onChange={(e) => setAutomatico(e.target.checked)} />{' '}
          Atualizar a cada {intervalo} segundos
        </label>
      </form>
      </AcoesDaPagina>

      <div
        style={{
          padding: '2rem',
          backgroundColor: '#F8FAFC',
          borderRadius: '8px',
        }}
      >
        {erro && <p style={{ color: '#DC2626', marginBottom: '1rem' }}>{erro}</p>}

        {!resultado && !erro && (
          <p style={{ color: '#64748B', fontSize: '1.1rem' }}>
            Informe a placa para visualizar a localização em tempo real.
          </p>
        )}

        {resultado && (
          <div style={{ color: '#1E293B', lineHeight: '1.7' }}>
            <h3 style={{ marginBottom: '1rem' }}>Última posição registrada</h3>
            {resultado.veiculo.marca === 'TESTE' && resultado.veiculo.modelo === 'SIMULACAO' && (
              <p role="status"><strong>SIMULAÇÃO: posições fictícias de um veículo de teste.</strong></p>
            )}
            <p>
              <strong>Placa:</strong> {resultado.veiculo.placa}
            </p>
            <p>
              <strong>Veículo:</strong> {resultado.veiculo.marca} {resultado.veiculo.modelo}
            </p>
            <p>
              <strong>Cliente:</strong> {resultado.veiculo.cliente}
            </p>
            <p>
              <strong>Latitude / Longitude:</strong> {resultado.localizacao.coordenadas}
            </p>
            <p>
              <strong>Endereço:</strong> {resultado.localizacao.endereco || 'Não disponível'}
            </p>
            <p>
              <strong>Velocidade:</strong> {resultado.localizacao.velocidade} km/h
            </p>
            <p>
              <strong>Status:</strong> {resultado.localizacao.status}
            </p>
            <p>
              <strong>Registrado em:</strong>{' '}
              {new Date(resultado.localizacao.dataHora).toLocaleString('pt-BR')}
            </p>
            <a
              href={`https://www.openstreetmap.org/?mlat=${encodeURIComponent(resultado.localizacao.latitude)}&mlon=${encodeURIComponent(resultado.localizacao.longitude)}#map=16/${encodeURIComponent(resultado.localizacao.latitude)}/${encodeURIComponent(resultado.localizacao.longitude)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ver posição no mapa
            </a>
            {Number.isFinite(latitude) && Number.isFinite(longitude) &&
              <MapaTrajeto key={resultado.veiculo.placa} posicoes={ultimaPosicao} modo="posicao" />}
            <TelemetriaVeiculo posicao={resultado.localizacao} />
            <HistoricoRastreamento key={`${resultado.veiculo.placa}:${veiculoId || ''}`} placa={resultado.veiculo.placa} veiculoId={veiculoId} />
          </div>
        )}
      </div>
    </div>
  );
};

export default Rastreamento;
