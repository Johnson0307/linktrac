import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url);
const {chaveTag,validarCadastro,validarDeteccoes,extrairTraccar,receberDeteccoes,TagBle}=require('../src/operacao/tagsBle');
const {Dispositivo}=require('../src/operacao/modelos');
const {regraApi}=require('../src/services/acessosCliente');
const empresa='507f1f77bcf86cd799439011',receptor='507f1f77bcf86cd799439012';
const frame=()=>({dataHora:new Date(Date.now()-1000).toISOString(),mensagemId:'leitura-1',tags:[{formato:'mac',identificador:'AA:BB:CC:DD:EE:FF',rssi:-65}]});
afterEach(()=>vi.restoreAllMocks());
it('normaliza identificadores equivalentes e valida limites de iBeacon',()=>{
 expect(chaveTag('mac','aa-bb-cc-dd-ee-ff').identificador).toBe('AABBCCDDEEFF');
 expect(chaveTag('ibeacon','00112233-4455-6677-8899-aabbccddeeff:00001:65535').identificador).toBe('00112233445566778899aabbccddeeff:1:65535');
 expect(()=>chaveTag('ibeacon','00112233445566778899aabbccddeeff:1:65536')).toThrow();
 expect(()=>chaveTag('mac','telefone')).toThrow();
 expect(chaveTag('eddystone','AABBCCDDEEFF00112233445566778899').identificador).toBe('aabbccddeeff00112233445566778899');
});
it('não aceita cadastro com situação inventada nem permite injetar empresa e última posição',()=>{
 const body={nome:'Ferramenta',bem:'Máquina 1',formato:'mac',identificador:'AABBCCDDEEFF',status:'a_testar',ativo:true,clienteId:'outra',ultimaDeteccao:{latitude:9}};
 expect(validarCadastro(body)).not.toHaveProperty('clienteId');expect(validarCadastro(body)).not.toHaveProperty('ultimaDeteccao');
 expect(()=>validarCadastro({...body,status:'automaticamente_homologada'})).toThrow();
});
it('rejeita duplicatas canônicas, horário sem fuso e coordenadas incompletas',()=>{
 const f=frame();expect(()=>validarDeteccoes({...f,tags:[...f.tags,{formato:'mac',identificador:'aabbccddeeff'}]})).toThrow('uma vez');
 expect(()=>validarDeteccoes({...f,dataHora:'2026-01-01T10:00:00'})).toThrow();
 expect(()=>validarDeteccoes({...f,latitude:1})).toThrow('duas coordenadas');
 expect(()=>validarDeteccoes({...f,tags:[{...f.tags[0],rssi:NaN}]})).toThrow();
});
it('separa sensores beacon e advanced tag no mesmo pacote e converte unidades de bateria',()=>{
 const tags=extrairTraccar({attributes:{beacon1Uuid:'00112233445566778899aabbccddeeff',beacon1Major:1,beacon1Minor:2,beacon1Rssi:-40,beacon1Battery:2.9,tag1Mac:'AABBCCDDEEFF',tag1Rssi:-80,tag1Battery:3100,tag1LowBattery:0}});
 expect(tags.find(t=>t.formato==='mac')).toMatchObject({rssi:-80,bateriaV:3.1,bateriaBaixa:false});
 expect(tags.find(t=>t.formato==='ibeacon')).toMatchObject({rssi:-40,bateriaV:2.9});
 expect(tags[0]).not.toHaveProperty('distancia');
});
it('ignora atributos BLE desconhecidos sem bloquear posições GPS',()=>{
 expect(extrairTraccar({attributes:{tag1Mac:'invalido',tag2Id:'nao-conhecido'}})).toEqual([]);
 expect(extrairTraccar()).toEqual([]);
});
it('restringe detecção à empresa, receptor, vínculo e horário; reenvio não cria tag',async()=>{
 const exists=vi.spyOn(Dispositivo,'exists').mockResolvedValue({_id:receptor});
 const update=vi.spyOn(TagBle,'updateOne').mockResolvedValue({modifiedCount:0});
 const f=frame();expect(await receberDeteccoes({_id:receptor,clienteId:empresa},f)).toEqual({recebidas:1,atualizadas:0});
 expect(exists).toHaveBeenCalledWith({_id:receptor,clienteId:empresa,ativo:true});
 const [query,mutation,options]=update.mock.calls[0];
 expect(query).toMatchObject({clienteId:empresa,ativo:true,chave:'mac:AABBCCDDEEFF',vinculadaEm:{$lte:new Date(f.dataHora)}});
 expect(query.$and[0]).toEqual({$or:[{receptorId:null},{receptorId:receptor}]});
 expect(query.$and[1].$or[1]).toEqual({'ultimaDeteccao.dataHora':{$lt:new Date(f.dataHora)}});
 expect(mutation.$set.ultimaDeteccao).not.toHaveProperty('latitude');expect(options.upsert).not.toBe(true);
});
it('receptor desativado não atualiza tags',async()=>{
 vi.spyOn(Dispositivo,'exists').mockResolvedValue(null);const update=vi.spyOn(TagBle,'updateOne');
 await expect(receberDeteccoes({_id:receptor,clienteId:empresa},frame())).rejects.toMatchObject({status:404});expect(update).not.toHaveBeenCalled();
});
it('consulta e alteração de tags exigem permissões de equipamentos',()=>{
 expect(regraApi('/operacao/tags-ble','GET')).toEqual({modulos:['equipamentos'],alterar:false});
 expect(regraApi('/operacao/tags-ble/123','PUT')).toEqual({modulos:['equipamentos'],alterar:true});
});
