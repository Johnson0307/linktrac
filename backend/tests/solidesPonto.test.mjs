import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),express=require('express');
const ponto=require('../src/services/solidesPonto');
const Motorista=require('../src/models/Motorista'),Usuario=require('../src/models/Usuario');
const empresa='507f1f77bcf86cd799439011',id='507f1f77bcf86cd799439012';
const corpo=()=>({provedor:'solides',nomeOutro:'',liberada:false,token:''});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});
it('credencial criptografada fica vinculada à empresa e adulteração é recusada',()=>{
 vi.stubEnv('INTEGRACOES_CHAVE_CRIPTOGRAFIA','1'.repeat(64));
 const segredo='credencial-secreta-de-teste';const valor=ponto.proteger(segredo,empresa);
 expect(valor).not.toContain(segredo);expect(ponto.revelar(valor,empresa)).toBe(segredo);
 expect(()=>ponto.revelar(valor,id)).toThrow();
 const bytes=Buffer.from(valor,'base64');bytes[15]^=1;expect(()=>ponto.revelar(bytes.toString('base64'),empresa)).toThrow();
 expect(ponto.publico({credencial:valor})).not.toHaveProperty('credencial');
});
it('sem chave privada recusa armazenar token',()=>{
 vi.stubEnv('INTEGRACOES_CHAVE_CRIPTOGRAFIA','');vi.stubEnv('FINANCEIRO_CHAVE_CRIPTOGRAFIA','');
 expect(()=>ponto.proteger('teste',empresa)).toThrow('proteção');expect(ponto.publico(null).protecaoDisponivel).toBe(false);
});
it('valida fornecedor e impede enviar credenciais de outro fornecedor ao conector Sólides',()=>{
 expect(ponto.validarConta(corpo()).token).toBe('');
 expect(()=>ponto.validarConta({...corpo(),provedor:'http://invasor'})).toThrow();
 expect(()=>ponto.validarConta({...corpo(),provedor:'outro'})).toThrow();
 expect(()=>ponto.validarConta({...corpo(),token:'a'.repeat(25)+'\n'})).toThrow();
 expect(()=>ponto.validarConta({...corpo(),provedor:'pontotel',token:'a'.repeat(30)})).toThrow('conector');
});
it.each([[200,'conexao_aceita'],[401,'acesso_recusado'],[403,'acesso_recusado'],[404,'endereco_pendente'],[429,'limite_fornecedor'],[503,'fornecedor_indisponivel']])('teste GET %i não retorna conteúdo e bloqueia redirecionamento',async(status,estado)=>{
 const cancel=vi.fn();const enviar=vi.fn().mockResolvedValue({status,body:{cancel}});
 expect(await ponto.verificarCredencial('segredo',enviar)).toBe(estado);
 expect(enviar).toHaveBeenCalledWith('https://employer.tangerino.com.br/test',expect.objectContaining({method:'GET',redirect:'error',headers:{Authorization:'Basic segredo',Accept:'application/json'}}));expect(cancel).toHaveBeenCalled();
});
it('erros externos não expõem credencial',async()=>{
 expect(await ponto.verificarCredencial('segredo',async()=>{throw Error('segredo');})).toBe('fornecedor_indisponivel');
});
it('outro fornecedor ou credencial ausente não gera tráfego externo',async()=>{
 const get=vi.spyOn(ponto.Conta,'findById').mockReturnValue({select:()=>({lean:async()=>({provedor:'pontotel',liberada:true})})});
 const net=vi.spyOn(globalThis,'fetch');await expect(ponto.testarConta(empresa)).rejects.toMatchObject({status:409});
 get.mockReturnValue({select:()=>({lean:async()=>({provedor:'solides',liberada:false})})});
 await expect(ponto.testarConta(empresa)).rejects.toMatchObject({status:409});expect(net).not.toHaveBeenCalled();
});
it('limite de testes por empresa é atômico e antecede a requisição externa',async()=>{
 vi.stubEnv('INTEGRACOES_CHAVE_CRIPTOGRAFIA','1'.repeat(64));
 vi.spyOn(ponto.Conta,'findById').mockReturnValue({select:()=>({lean:async()=>({provedor:'solides',liberada:true,revisao:'r1',credencial:ponto.proteger('segredo',empresa)})})});
 const lock=vi.spyOn(ponto.Conta,'findOneAndUpdate').mockResolvedValue(null);const net=vi.spyOn(globalThis,'fetch');
 await expect(ponto.testarConta(empresa)).rejects.toMatchObject({status:429});
 expect(lock.mock.calls[0][0]).toMatchObject({_id:empresa,revisao:'r1'});expect(net).not.toHaveBeenCalled();
});
it('teste autorizado da credencial não exige nem altera declaração de liberação comercial',async()=>{
 vi.stubEnv('INTEGRACOES_CHAVE_CRIPTOGRAFIA','1'.repeat(64));
 vi.spyOn(ponto.Conta,'findById').mockReturnValue({select:()=>({lean:async()=>({provedor:'solides',liberada:false,revisao:'r1',credencial:ponto.proteger('segredo',empresa)})})});
 const lock=vi.spyOn(ponto.Conta,'findOneAndUpdate').mockResolvedValue({});
 const update=vi.spyOn(ponto.Conta,'updateOne').mockResolvedValue({});
 vi.spyOn(globalThis,'fetch').mockResolvedValue({status:200});
 expect((await ponto.testarConta(empresa)).estado).toBe('conexao_aceita');
 expect(lock.mock.calls[0][0]).not.toHaveProperty('liberada');
 expect(update.mock.calls[0][1].$set).not.toHaveProperty('liberada');
});
it('vínculo exige motorista da própria empresa e separa o fornecedor',async()=>{
 const exists=vi.spyOn(Motorista,'exists').mockResolvedValue(null);const salvar=vi.spyOn(ponto.Vinculo,'findOneAndUpdate').mockResolvedValue({});
 vi.spyOn(ponto.Conta,'findById').mockReturnValue({select:()=>({lean:async()=>({provedor:'oitchau'})})});
 const body={motoristaId:id,colaboradorExterno:'colab-1',clienteId:'outra',provedor:'solides'};
 await expect(ponto.salvarVinculo(empresa,'gestor',body)).rejects.toMatchObject({status:404});expect(salvar).not.toHaveBeenCalled();
 exists.mockResolvedValue({_id:id});await ponto.salvarVinculo(empresa,'gestor',body);
 expect(salvar.mock.calls[0][0]).toEqual({clienteId:empresa,provedor:'oitchau',motoristaId:id});
});
it('trocar fornecedor remove token anterior e descarta testes antigos',async()=>{
 vi.spyOn(ponto.Conta,'findById').mockReturnValue({select:()=>({lean:async()=>({provedor:'solides',revisao:'r1'})})});
 const salvar=vi.spyOn(ponto.Conta,'findOneAndUpdate').mockReturnValue({select:()=>({lean:async()=>({provedor:'pontotel',liberada:false})})});
 await ponto.salvarConta(empresa,'admin',{...corpo(),provedor:'pontotel'});
 expect(salvar.mock.calls[0][0]).toEqual({_id:empresa,revisao:'r1'});
 expect(salvar.mock.calls[0][1].$unset).toHaveProperty('credencial');
});
async function request(path,{role='admin',method='GET',body={},semToken=false,acessos}={}){
 vi.stubEnv('JWT_SECRET','teste');vi.spyOn(Usuario,'findById').mockReturnValue({select:async()=>({_id:id,clienteId:empresa,role,ativo:true,email:'teste@example.com'})});
 const app=express();app.use(express.json());if(acessos)app.use((req,res,next)=>{req.user={id,clienteId:empresa,role,acessos};next();});
 app.use(require('../src/routes/jornadaRoutes'));
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 try{const resposta=await fetch(`http://127.0.0.1:${server.address().port}${path}`,{method,headers:{'Content-Type':'application/json',...(!semToken?{Authorization:'Bearer '+require('jsonwebtoken').sign({id},process.env.JWT_SECRET)}:{})},...(method==='GET'?{}:{body:JSON.stringify(body)})});return{status:resposta.status,body:await resposta.json()};}finally{await new Promise(r=>server.close(r));}
}
it('rotas recusam visitante, operador e gestor em configuração de credenciais',async()=>{
 expect((await request('/',{semToken:true})).status).toBe(401);
 expect((await request('/',{role:'operador'})).status).toBe(403);
 expect((await request('/configuracao',{role:'gestor',method:'PUT',body:corpo()})).status).toBe(403);
});
it('consulta de operação não libera alteração e módulo bloqueado recusa consulta',async()=>{
 expect((await request('/vinculos',{method:'PUT',acessos:{operacao:'consulta'}})).status).toBe(403);
 expect((await request('/',{acessos:{operacao:'bloqueado'}})).status).toBe(403);
});
it('consulta retorna somente vínculos do fornecedor e motoristas da própria empresa',async()=>{
 vi.spyOn(require('../src/services/lembretePonto'),'obterConfiguracao').mockResolvedValue({ativo:false,canal:'web_aberta'});
 vi.spyOn(ponto,'obterConta').mockResolvedValue({provedor:'solides'});
 const v=vi.spyOn(ponto.Vinculo,'find').mockReturnValue({sort:()=>({limit:()=>({lean:async()=>[]})})});
 const m=vi.spyOn(Motorista,'find').mockReturnValue({select:()=>({sort:()=>({limit:()=>({lean:async()=>[]})})})});
 expect((await request('/')).status).toBe(200);expect(v).toHaveBeenCalledWith({clienteId:empresa,provedor:'solides'});expect(m).toHaveBeenCalledWith({clienteId:empresa});
});
