import { expect, it } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {validarTelemetria,eventosTelemetria}=require('../src/operacao/telemetria');
const {padroes,validarConfig}=require('../src/operacao/configuracao');
const {validar,horario}=require('../src/operacao/validacao');
const {converterTraccar}=require('../src/operacao/traccar');
const {resumirFinanceiro}=require('../src/operacao/financeiro');
const id='507f1f77bcf86cd799439011';
it('preserva leituras zero e falso sem aceitar propriedades estranhas',()=>{
 const r=validarTelemetria({rpm:0,portaAberta:false,sensores:[{id:'porta',tipo:'porta',valor:false}],senha:'x'});
 expect(r.erros).toEqual([]);expect(r.dados).toMatchObject({rpm:0,portaAberta:false});expect(r.dados).not.toHaveProperty('senha');
});
it.each([{rpm:-1},{combustivelPct:101},{dtcs:['senha']},{sensores:[{id:'a',tipo:'porta',valor:1}]},{sensores:[{id:'a',tipo:'porta',valor:true},{id:'a',tipo:'porta',valor:false}]}])('recusa leituras inválidas %j',body=>expect(validarTelemetria(body).erros.length).toBeGreaterThan(0));
it('não cria alertas de sensores ausentes nem deduz ignição de velocidade',()=>expect(eventosTelemetria({velocidade:0,telemetria:{}},null,padroes)).toEqual([]));
it('calcula saída de cerca e queda apenas entre medições próximas e cronológicas',()=>{
 const anterior={latitude:0,longitude:0,dataHora:'2026-01-01T10:00:00Z',telemetria:{combustivelPct:80}};
 const atual={latitude:0,longitude:.01,dataHora:'2026-01-01T10:01:00Z',telemetria:{combustivelPct:40}};
 const cerca={id:'a',ativo:true,nome:'Entrega',latitude:0,longitude:0,raioMetros:100};
 expect(eventosTelemetria(atual,anterior,padroes,[cerca]).map(x=>x.tipo)).toEqual(['combustivel','cerca_a_saida']);
 expect(eventosTelemetria(anterior,atual,padroes,[cerca])).toEqual([]);
 expect(eventosTelemetria({...atual,dataHora:'2026-01-01T12:00:00Z'},anterior,padroes,[cerca])).toEqual([]);
});
it('configurações recusam temperatura invertida e removem tentativa de trocar empresa',()=>{
 expect(validarConfig({...padroes,temperaturaMinima:20,temperaturaMaxima:10}).erro).toBeTruthy();
 expect(validarConfig({...padroes,clienteId:'outra'}).dados).not.toHaveProperty('clienteId');
});
it('cadastros exigem referências válidas e datas reais',()=>{
 expect(horario('2026-02-30T10:00:00Z')).toBe(false);
 expect(validar('__proto__',{}).erros.length).toBeGreaterThan(0);
 expect(validar('planos',{veiculoId:id,servico:'Óleo',ultimaData:'2026-01-01',ultimoOdometro:0}).erros.length).toBeGreaterThan(0);
 expect(validar('abastecimentos',{veiculoId:id,dataHora:'2026-01-01T10:00:00Z',litros:10,valorReais:50,odometroKm:0,latitude:0}).erros.length).toBeGreaterThan(0);
});
it('Traccar converte unidades conhecidas e não presume unidade de combustível',()=>{
 const r=converterTraccar({device:{uniqueId:'abc'},position:{id:1,fixTime:'2026-01-01T10:00:00Z',latitude:0,longitude:0,speed:10,attributes:{odometer:12500,fuel:50,power:12,alarm:'hardBraking'}}},'abc');
 expect(r.velocidade).toBe(18.52);expect(r.telemetria).toEqual({odometroKm:12.5,eventosDirecao:['frenagem']});
 expect(()=>converterTraccar({device:{uniqueId:'outro'},position:{}},'abc')).toThrow();
});
it('recebe sinais de comunicação do receptor sem criar uma posição GPS fictícia', () => {
 const body={device:{uniqueId:'abc'},position:{id:0,fixTime:'2026-01-01T10:00:00Z',
   serverTime:'2026-01-01T10:01:00Z',valid:true,latitude:1,longitude:2,attributes:{ignition:true}}};
 expect(()=>converterTraccar(body,'abc')).toThrow('sem identificador');
 const leitura=converterTraccar(body,'abc',{aceitarComunicacaoSemPosicao:true});
 expect(leitura).toMatchObject({semGPS:true,dataHora:'2026-01-01T10:01:00.000Z',ignicao:true});
 expect(leitura).not.toHaveProperty('latitude');expect(leitura).not.toHaveProperty('mensagemId');
 expect(()=>converterTraccar({...body,position:{...body.position,serverTime:undefined}},'abc',
   {aceitarComunicacaoSemPosicao:true})).toThrow('horário de recebimento');
});
it('financeiro não apresenta custo/km sem base ou com regressão do odômetro',()=>{
 const fuel=[{dados:{valorReais:10.01,litros:2}}];
 expect(resumirFinanceiro(fuel,[],[]).custoPorKmReais).toBeNull();
 const leitura=(km,t)=>({veiculoId:id,dataHora:`2026-01-01T${t}:00:00Z`,telemetria:{odometroKm:km}});
 expect(resumirFinanceiro(fuel,[],[leitura(100,'10'),leitura(90,'11')]).custoPorKmReais).toBeNull();
 expect(resumirFinanceiro(fuel,[{custoCentavos:999}],[leitura(100,'10'),leitura(110,'11')])).toMatchObject({custoTotalCentavos:2000,distanciaObservadaKm:10,custoPorKmReais:2});
});

it('não divide custos de veículo sem leituras pela distância de outro veículo',()=>{const leituras=[{veiculoId:'a',dataHora:'2026-01-01T10:00:00Z',telemetria:{odometroKm:100}},{veiculoId:'a',dataHora:'2026-01-01T11:00:00Z',telemetria:{odometroKm:110}}];expect(resumirFinanceiro([{dados:{veiculoId:'b',valorReais:100,litros:10}}],[],leituras).custoPorKmReais).toBeNull();});
