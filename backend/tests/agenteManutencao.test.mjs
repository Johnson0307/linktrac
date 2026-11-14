import { expect, it, afterEach, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { analisar, validarConfig } = require('../src/operacao/agenteRegras');
const ia = require('../src/operacao/agenteIA');
const agora = new Date('2026-10-27T12:00:00Z');
const config = { temperaturaMotorMax: 105, tensaoMinima: 11.5 };
const leitura = (min, t = {}) => ({
  dataHora: new Date(+agora - min * 60000),
  ignicao: true,
  telemetria: { temperaturaMotor: 90, tensaoBateria: 13.5, odometroKm: 1000 - min, ...t },
});
const executar = (dados = {}) => analisar({ agora, config, ...dados });
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});
it('sem equipamento apresenta dados insuficientes sem inventar diagnóstico', () => {
  const r = executar();
  expect(r.status).toBe('dados_insuficientes');
  expect(r.achados).toEqual([]);
  expect(r.quantidade).toBe(0);
});
it('três medições separadas de temperatura produzem evidências e recomendação', () => {
  const r = executar({
    leituras: [
      leitura(0, { temperaturaMotor: 110 }),
      leitura(5, { temperaturaMotor: 111 }),
      leitura(10, { temperaturaMotor: 112 }),
    ],
  });
  expect(r.status).toBe('inspecao_recomendada');
  expect(r.achados[0].codigo).toBe('temperatura_recorrente');
  expect(r.achados[0].evidencias).toHaveLength(3);
  expect(r.achados[0].evidencias[0].limite).toBe(105);
});
it('mensagens próximas ou repetidas não caracterizam recorrência', () => {
  const r = executar({
    leituras: [
      leitura(0, { temperaturaMotor: 110 }),
      leitura(0, { temperaturaMotor: 110 }),
      leitura(1, { temperaturaMotor: 110 }),
    ],
  });
  expect(r.achados).toEqual([]);
  expect(r.status).toBe('dados_insuficientes');
});
it('não avalia temperatura sem referência específica ou com ignição desconhecida', () => {
  const l = [0, 5, 10].map((m) => leitura(m, { temperaturaMotor: 120 }));
  expect(executar({ leituras: l, config: {} }).achados).toEqual([]);
  expect(executar({ leituras: l.map((p) => ({ ...p, ignicao: null })) }).achados).toEqual([]);
});
it('descarta leituras fora da janela e futuras', () => {
  const r = executar({
    leituras: [
      leitura(-1, { temperaturaMotor: 120 }),
      leitura(8 * 1440, { temperaturaMotor: 120 }),
    ],
  });
  expect(r.quantidade).toBe(0);
  expect(r.achados).toEqual([]);
});
it('com dados recentes suficientes normais, indica em dia apenas nos critérios avaliados', () =>
  expect(executar({ leituras: [leitura(0), leitura(5), leitura(10)] }).status).toBe('em_dia'));
it('leituras normais antigas não liberam estado em dia', () =>
  expect(executar({ leituras: [leitura(1500), leitura(1510), leitura(1520)] }).status).toBe(
    'dados_insuficientes'
  ));
it('DTC repetido é descrito como código sem atribuir peça defeituosa', () => {
  const r = executar({
    leituras: [leitura(0, { dtcs: ['P0300'] }), leitura(10, { dtcs: ['P0300'] })],
  });
  expect(r.achados[0].codigo).toBe('dtc_P0300');
  expect(r.achados[0].recomendacao).toContain('não determina sozinho');
});
it('detecta tendência perto da referência sem tratar aquecimento como defeito confirmado', () => {
  const r = executar({
    leituras: [
      leitura(30, { temperaturaMotor: 80 }),
      leitura(25, { temperaturaMotor: 82 }),
      leitura(20, { temperaturaMotor: 84 }),
      leitura(10, { temperaturaMotor: 96 }),
      leitura(5, { temperaturaMotor: 98 }),
      leitura(0, { temperaturaMotor: 100 }),
    ],
  });
  expect(r.achados[0].codigo).toBe('tendencia_temperatura');
});
it('revisão por prazo funciona sem equipamento e serviço novo renova a base', () => {
  const plano = {
    _id: 'p',
    dados: {
      ativo: true,
      servico: 'Óleo',
      ultimaData: '2026-01-01',
      ultimoOdometro: 0,
      intervaloDias: 30,
    },
  };
  expect(executar({ planos: [plano] }).achados[0].codigo).toBe('plano_p');
  const r = executar({
    planos: [plano],
    servicos: [{ servico: 'Óleo', dataServico: '2026-10-26', quilometragem: 1000 }],
  });
  expect(r.achados).toEqual([]);
});
it('odômetro regredido suspende avaliação por km', () => {
  const plano = {
    _id: 'p',
    dados: {
      ativo: true,
      servico: 'Óleo',
      ultimaData: '2026-01-01',
      ultimoOdometro: 0,
      intervaloKm: 500,
    },
  };
  const r = executar({
    planos: [plano],
    leituras: [leitura(10, { odometroKm: 1000 }), leitura(0, { odometroKm: 900 })],
  });
  expect(r.achados).toEqual([]);
  expect(r.ausencias.join(' ')).toContain('regrediu');
});
it('configurações permitem critérios sem referência e recusam números inválidos', () => {
  expect(validarConfig({ temperaturaMotorMax: null, tensaoMinima: '' }).dados).toEqual({
    temperaturaMotorMax: null,
    tensaoMinima: null,
  });
  expect(validarConfig({ temperaturaMotorMax: '100' }).erro).toBeTruthy();
  expect(validarConfig({ temperaturaMotorMax: 300 }).erro).toBeTruthy();
  expect(validarConfig({ ...config, clienteId: 'outro' }).dados).not.toHaveProperty('clienteId');
});
it('IA não configurada não faz requisição externa', async () => {
  vi.stubEnv('LINKTRAC_MANUTENCAO_IA', 'false');
  const spy = vi.spyOn(globalThis, 'fetch');
  await expect(ia.interpretar(executar())).rejects.toThrow('não configurada');
  expect(spy).not.toHaveBeenCalled();
});
it('contexto externo omite texto livre e identificadores de plano', () => {
  const r = executar({
    planos: [
      {
        _id: 'id-secreto',
        dados: {
          ativo: true,
          servico: 'texto sigiloso',
          ultimaData: '2026-01-01',
          intervaloDias: 1,
          ultimoOdometro: 0,
        },
      },
    ],
  });
  const texto = JSON.stringify(ia.prepararContexto(r));
  expect(texto).not.toContain('texto sigiloso');
  expect(texto).not.toContain('id-secreto');
});
it('falha do provedor não altera achados técnicos', async () => {
  vi.stubEnv('LINKTRAC_MANUTENCAO_IA', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'chave-teste');
  vi.stubEnv('OPENAI_MODEL', 'modelo-teste');
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: false });
  const r = executar();
  await expect(ia.interpretar(r)).rejects.toThrow();
  expect(r.status).toBe('dados_insuficientes');
});
it('envio ao provedor é limitado e não armazena resposta no serviço', async () => {
  vi.stubEnv('LINKTRAC_MANUTENCAO_IA', 'true');
  vi.stubEnv('OPENAI_API_KEY', 'chave-teste');
  vi.stubEnv('OPENAI_MODEL', 'modelo-teste');
  const fetch = vi
    .spyOn(globalThis, 'fetch')
    .mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: 'Dados insuficientes.' }] },
        ],
      }),
    });
  expect((await ia.interpretar(executar())).texto).toBe('Dados insuficientes.');
  expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({
    store: false,
    max_output_tokens: 1200,
    model: 'modelo-teste',
  });
});
