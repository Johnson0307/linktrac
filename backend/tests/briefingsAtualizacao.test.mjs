import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { validarTelemetria } = require('../src/operacao/telemetria');
const { analisar, validarConfig } = require('../src/operacao/agenteRegras');
const { avaliarDpf } = require('../src/operacao/dpf');
const { validarFirmware } = require('../src/operacao/firmwareEquipamento');
const { interpretarBriefing } = require('../src/services/interpretarBriefing');
it('DPF preserva zero e falso e rejeita estados e unidades inválidas', () => {
  expect(validarTelemetria({ dpfFuligemPct: 0, dpfLuz: false, dpfRegeneracao: 'inativa', dpfRegeneracoesInterrompidas: 0 }).dados).toEqual({ dpfFuligemPct: 0, dpfRegeneracoesInterrompidas: 0, dpfLuz: false, dpfRegeneracao: 'inativa' });
  for (const d of [{dpfFuligemPct:101}, {dpfLuz:1}, {dpfRegeneracao:'forcar'}, {dpfFuligemPct:'10'}]) expect(validarTelemetria(d).erros.length).toBeGreaterThan(0);
});
it('sem limites do fabricante não classifica percentual como falha nem normal', () => {
  expect(avaliarDpf({ dpfFuligemPct: 90 }).estado).toBe('referencias_pendentes');
  expect(avaliarDpf({}).estado).toBe('sem_dados');
  expect(avaliarDpf({ dpfLuz: true }).estado).toBe('inspecao_recomendada');
  expect(avaliarDpf({ dpfRegeneracao: 'interrompida' }).estado).toBe('observar');
});
it('referências DPF precisam ser pareadas e específicas do veículo', () => {
  expect(validarConfig({dpfObservarPct:60}).erro).toBeTruthy();
  expect(validarConfig({dpfObservarPct:90,dpfInspecaoPct:60}).erro).toBeTruthy();
  const config = validarConfig({dpfObservarPct:60,dpfInspecaoPct:85}).dados;
  expect(avaliarDpf({dpfFuligemPct:65},config).estado).toBe('observar');
  expect(avaliarDpf({dpfFuligemPct:90},config).estado).toBe('inspecao_recomendada');
  expect(avaliarDpf({dpfFuligemPct:10,dpfLuz:false},config).estado).toBe('sem_indicio_nos_criterios');
});
it('análise considera luz isolada e não transforma leitura antiga em urgência atual', () => {
  const agora = new Date();
  const r = analisar({agora,leituras:[{dataHora:agora,telemetria:{dpfLuz:true}}]});
  expect(r.dpf.estado).toBe('inspecao_recomendada');expect(r.achados[0].codigo).toBe('dpf_inspecao_recomendada');
  const antigo = analisar({agora,leituras:[{dataHora:new Date(+agora-2*86400000),telemetria:{dpfLuz:true}}]});
  expect(antigo.dpf.estado).toBe('dados_antigos');expect(antigo.achados).toEqual([]);
});
it('firmware não aceita execução, data futura ou registro concluído sem versão e data', () => {
  expect(validarFirmware({atual:'v1',recursos:['GPS','GPS'],comando:'atualizar'})).toMatchObject({atual:'v1',recursos:['GPS'],estado:'nao_informado'});
  expect(validarFirmware({atual:'v1',comando:'atualizar'})).not.toHaveProperty('comando');
  for (const d of [{estado:'concluida'}, {estado:'falha'}, {recursos:['']}, {atualizadoEm:'2099-01-01T10:00:00Z'}]) expect(()=>validarFirmware(d)).toThrow();
});
it('briefing Markdown conserva lista de propostas e ignora separador da tabela', () => {
  const texto = '# Briefing Linktrac — 23 de novembro de 2026\n## 1. DPF\n**Ideia para a Linktrac:** criar regra para o filtro de partículas:\n\n- Nível de fuligem;\n- Códigos CAN;\n\n---\n## 2. Firmware\n**Ideia para a Linktrac:** registrar versão do firmware dos equipamentos.\n';
  const r = interpretarBriefing(texto)[0];expect(r.itens).toHaveLength(2);expect(r.itens[0].texto).toContain('Códigos CAN');
  const tabela = 'Briefing Linktrac — 16 de novembro de 2026\n| Novidade | Ideia para a Linktrac |\n| --- | --- |\n| Equipamento | Registrar versões e falhas do firmware do rastreador. |';
  expect(interpretarBriefing(tabela)[0].itens).toHaveLength(1);
});
