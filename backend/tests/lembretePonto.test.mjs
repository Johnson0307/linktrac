import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const ponto = require('../src/services/lembretePonto');
const Motorista = require('../src/models/Motorista');
const { Notificacao } = require('../src/operacao/modelos');
const mongoose = require('mongoose');
const empresa = '507f1f77bcf86cd799439011', motorista = '507f1f77bcf86cd799439012';
const veiculo = { _id: '507f1f77bcf86cd799439013', clienteId: empresa, placa: 'TESTE01' };
const leitura = (campos = {}) => ({ fonte: 'dispositivo', dispositivoId: 'd', ignicao: true,
  dataHora: new Date(), telemetria: { identificadorMotorista: 'leitor-1' }, ...campos });
afterEach(() => vi.restoreAllMocks());
it('recusa simulação, veículo desativado, fonte sem autenticação, atraso e futuro', () => {
  expect(ponto.leituraValida(veiculo, leitura())).toBe(true);
  for (const l of [leitura({fonte:'simulado'}), leitura({dispositivoId:null}), leitura({ignicao:null}),
    leitura({dataHora:new Date(Date.now()-300001)}), leitura({dataHora:new Date(Date.now()+60000)})]) {
    expect(ponto.leituraValida(veiculo, l)).toBe(false);
  }
  expect(ponto.leituraValida({...veiculo,ativo:false},leitura())).toBe(false);
});
it('vínculo administrativo nunca gera lembrete sem identificador enviado pelo equipamento', () => {
  expect(ponto.transicao(null, leitura({motoristaId:motorista,telemetria:{}}), motorista).avisar).toBe(false);
  expect(ponto.transicao(null, leitura(), null).avisar).toBe(false);
});
it('uma identificação por ciclo, inclusive quando o identificador chega após a ignição', () => {
  const tempo = Date.now();
  const ligar = ponto.transicao(null, leitura({dataHora:new Date(tempo),telemetria:{}}), null);
  expect(ligar.avisar).toBe(false);
  const identificar = ponto.transicao(ligar.estado, leitura({dataHora:new Date(tempo+1)}), motorista);
  expect(identificar.avisar).toBe(true);
  const repetir = ponto.transicao(identificar.estado, leitura({dataHora:new Date(tempo+2)}), motorista);
  expect(repetir.avisar).toBe(false);expect(repetir.estado.ciclo).toBe(ligar.estado.ciclo);
  const desligar = ponto.transicao(repetir.estado, leitura({dataHora:new Date(tempo+3),ignicao:false}), motorista);
  expect(desligar.avisar).toBe(false);expect(desligar.estado.motoristaId).toBe(null);
  expect(ponto.transicao(desligar.estado, leitura({dataHora:new Date(tempo+4)}), motorista).avisar).toBe(true);
});
it('troca de motorista exige nova identificação e mensagens fora de ordem não alteram estado', () => {
  const agora = Date.now();
  const a = ponto.transicao(null, leitura({dataHora:new Date(agora)}), motorista).estado;
  expect(ponto.transicao(a, leitura({dataHora:new Date(agora)}), motorista)).toBe(null);
  expect(ponto.transicao(a, leitura({dataHora:new Date(agora-1000)}), motorista)).toBe(null);
  expect(ponto.transicao(a, leitura({dataHora:new Date(agora+1)}), 'outro').avisar).toBe(true);
});
it('configuração começa desligada e usuário não escolhe a empresa no corpo', async () => {
  vi.spyOn(ponto.Configuracao,'findById').mockReturnValue({lean:async()=>null});
  expect(await ponto.obterConfiguracao(empresa)).toEqual({ativo:false,canal:'web_aberta'});
  const save = vi.spyOn(ponto.Configuracao,'updateOne').mockResolvedValue({});
  await ponto.salvarConfiguracao(empresa,'admin',{ativo:true,clienteId:'outra'});
  expect(save.mock.calls[0][0]).toEqual({_id:empresa});
  await expect(ponto.salvarConfiguracao(empresa,'admin',{ativo:'sim'})).rejects.toMatchObject({status:400});
});
it('sem ativação não consulta identificadores nem cria estado ou notificação', async () => {
  vi.spyOn(ponto.Configuracao,'findById').mockReturnValue({lean:async()=>null});
  const find = vi.spyOn(Motorista,'findOne'), save = vi.spyOn(ponto.Estado,'updateOne');
  await ponto.processar(veiculo,leitura());
  expect(find).not.toHaveBeenCalled();expect(save).not.toHaveBeenCalled();
});
it('transação publica lembrete e ciclo juntos, consultando identificador apenas na empresa', async () => {
  vi.spyOn(ponto.Configuracao,'findById').mockReturnValue({lean:async()=>({ativo:true})});
  const find = vi.spyOn(Motorista,'findOne').mockReturnValue({select:()=>({lean:async()=>({_id:motorista})})});
  vi.spyOn(ponto.Estado,'init').mockResolvedValue();vi.spyOn(Notificacao,'init').mockResolvedValue();
  const sessao={withTransaction:async cb=>cb(),endSession:vi.fn()};
  vi.spyOn(mongoose,'startSession').mockResolvedValue(sessao);
  vi.spyOn(ponto.Estado,'findOne').mockReturnValue({session:()=>({lean:async()=>null})});
  const estado=vi.spyOn(ponto.Estado,'updateOne').mockResolvedValue({});
  const aviso=vi.spyOn(Notificacao,'updateOne').mockResolvedValue({});
  await ponto.processar(veiculo,leitura());
  expect(find).toHaveBeenCalledWith({clienteId:empresa,identificador:'leitor-1',status:'ativo'});
  expect(estado.mock.calls[0][2].session).toBe(sessao);
  expect(aviso.mock.calls[0][1].$setOnInsert).toMatchObject({tipo:'lembrete_ponto',motoristaId:motorista});
  expect(aviso.mock.calls[0][2].session).toBe(sessao);expect(sessao.endSession).toHaveBeenCalled();
});
it('conta ambígua ou outro perfil não pode ler os lembretes de um motorista', async () => {
  vi.spyOn(Motorista,'find').mockReturnValue({select:()=>({limit:()=>({lean:async()=>[{_id:'a'},{_id:'b'}]})})});
  await expect(ponto.motoristaDaConta({role:'motorista',clienteId:empresa,email:'teste@example.com'})).rejects.toMatchObject({status:403});
  await expect(ponto.motoristaDaConta({role:'admin',clienteId:empresa})).rejects.toMatchObject({status:403});
});
it('dispensar usa motorista autenticado e empresa; não registra ponto nem aceita ID de terceiro', async () => {
  const find=vi.spyOn(Motorista,'find').mockReturnValue({select:()=>({limit:()=>({lean:async()=>[{_id:motorista}]})})});
  const update=vi.spyOn(Notificacao,'updateOne').mockResolvedValue({matchedCount:1});
  const user={role:'motorista',clienteId:empresa,email:'teste@example.com'};
  expect(await ponto.dispensar(user,veiculo._id)).toEqual({dispensado:true,pontoRegistrado:false});
  expect(find).toHaveBeenCalledWith({clienteId:empresa,email:user.email,status:'ativo'});
  expect(update.mock.calls[0][0]).toMatchObject({clienteId:empresa,motoristaId:motorista,tipo:'lembrete_ponto'});
  update.mockResolvedValue({matchedCount:0});await expect(ponto.dispensar(user,veiculo._id)).rejects.toMatchObject({status:404});
});
