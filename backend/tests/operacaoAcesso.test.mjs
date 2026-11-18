import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);const express=require('express');const crypto=require('crypto');
const Usuario=require('../src/models/Usuario');const Veiculo=require('../src/models/Veiculo');
const {Gateway,Dispositivo}=require('../src/operacao/modelos');
const empresa='507f1f77bcf86cd799439011',id='507f1f77bcf86cd799439012';
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
async function request(path,{role='admin',body={},headers={},integracao=false,method='POST'}={}){
 vi.stubEnv('JWT_SECRET','teste-segredo');vi.spyOn(Usuario,'findById').mockReturnValue({select:async()=>({_id:id,clienteId:empresa,role,ativo:true,email:'teste@example.com'})});
 const app=express();app.use(express.json());app.use(integracao?require('../src/operacao/integracao'):require('../src/operacao/rotas').router);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const r=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json',Authorization:`Bearer ${require('jsonwebtoken').sign({id},process.env.JWT_SECRET)}`,...headers},...(method==='GET'?{}:{body:JSON.stringify(body)})});return{status:r.status,body:await r.json()};}finally{await new Promise(r=>server.close(r));}
}
it('operador não pode cadastrar equipamentos, cargas ou gateways',async()=>{for(const path of ['/dispositivos','/cargas','/gateways'])expect((await request(path,{role:'operador'})).status).toBe(403);});
it('equipamento não pode ser vinculado a veículo de outra empresa',async()=>{const find=vi.spyOn(Veiculo,'exists').mockResolvedValue(null);expect((await request('/dispositivos',{body:{nome:'Teste',veiculoId:id,clienteId:'outra'}})).status).toBe(404);expect(find).toHaveBeenCalledWith({_id:id,clienteId:empresa});});
it('referência de carga exige veículo da empresa autenticada',async()=>{vi.spyOn(Veiculo,'exists').mockResolvedValue(null);expect((await request('/cargas',{body:{codigo:'A',veiculoId:id,destinatario:'Teste',endereco:'Rua',latitude:0,longitude:0}})).status).toBe(404);});
it('integração recusa ausência de credenciais antes de consultar o banco',async()=>{const find=vi.spyOn(Dispositivo,'findOne');expect((await request('/posicoes',{integracao:true})).status).toBe(401);expect(find).not.toHaveBeenCalled();});
it('gateway só procura equipamentos ativos da própria empresa',async()=>{
 const token='a'.repeat(64);vi.spyOn(Gateway,'findOne').mockReturnValue({select:async()=>({clienteId:empresa,tokenHash:crypto.createHash('sha256').update(token).digest('hex')})});
 const find=vi.spyOn(Dispositivo,'findOne').mockResolvedValue(null);
 expect((await request('/traccar',{integracao:true,headers:{'x-gateway-id':id,'x-gateway-token':token},body:{device:{uniqueId:'123'}}})).status).toBe(401);
 expect(find).toHaveBeenCalledWith({clienteId:empresa,codigoExterno:'123',ativo:true});
});
it('receptor gerenciado exige credencial privada antes de consultar equipamentos',async()=>{
 vi.stubEnv('TRACCAR_RECEPTOR_TOKEN','a'.repeat(64));
 const find=vi.spyOn(Dispositivo,'findOne');
 const resposta=await request('/traccar-gerenciado',{integracao:true,headers:{'x-receptor-token':'b'.repeat(64)}});
 expect(resposta.status).toBe(401); expect(find).not.toHaveBeenCalled();
});
it('receptor gerenciado restringe IMEI ao cadastro autorizado e ignora posições anteriores ao vínculo',async()=>{
 const token='a'.repeat(64);vi.stubEnv('TRACCAR_RECEPTOR_TOKEN',token);
 const find=vi.spyOn(Dispositivo,'findOne').mockReturnValue({select:async()=>({_id:id,receptorTraccarDesde:new Date('2026-11-18T18:00:00Z')})});
 const veiculo=vi.spyOn(Veiculo,'findOne');
 const resposta=await request('/traccar-gerenciado',{integracao:true,headers:{'x-receptor-token':token},body:{
   device:{uniqueId:'123456789012345',attributes:{linktracCadastro:id}},position:{fixTime:'2026-11-18T17:59:00Z'},
 }});
 expect(find).toHaveBeenCalledWith({_id:id,codigoExterno:'123456789012345',receptorTraccar:true,ativo:true});
 expect(resposta.status).toBe(200);expect(resposta.body.ignorada).toBe(true);expect(veiculo).not.toHaveBeenCalled();
});
