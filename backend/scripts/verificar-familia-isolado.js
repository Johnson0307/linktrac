/* Autoteste descartável: nunca executa contra banco de produção ou usa pessoas reais. */
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { randomUUID } = require('node:crypto');
async function main() {
  if(process.env.FAMILIA_TESTE_DESCARTAVEL!=='1')throw Error('Confirme o ambiente descartável de teste.');
  const uri=process.env.MONGO_FAMILIA_TESTE_URI;
  if(!uri)throw Error('Informe a conexão do banco descartável.');
  const parsed=new URL(uri);
  if(!/^\/linktrac_familia_teste_[a-z0-9_]+$/.test(parsed.pathname)||!['127.0.0.1','localhost'].includes(parsed.hostname))throw Error('O autoteste exige banco local isolado com nome de teste.');
  await mongoose.connect(uri,{serverSelectionTimeoutMS:10000});
  const Usuario=require('../src/models/Usuario'),Cliente=require('../src/models/Cliente');
  const {Responsavel,Pessoa,Posicao,Auditoria,Limite}=require('../src/familia/modelos');
  const {web,aparelho}=require('../src/familia/rotas');
  const oid=()=>new mongoose.Types.ObjectId();
  const central=oid(),a=oid(),b=oid();
  process.env.LINKTRAC_CLIENT_ID=String(central);
  await Cliente.create([{_id:central,nome:'CENTRAL TESTE',slug:'central-teste'},{_id:a,nome:'FAMILIA TESTE A',slug:'familia-teste-a',acessos:{familia:'configurar'}},{_id:b,nome:'FAMILIA TESTE B',slug:'familia-teste-b',acessos:{familia:'configurar'}}]);
  const pessoas=await Usuario.create([{nome:'TITULAR TESTE A',email:'titular-a@example.invalid',senha:randomUUID(),clienteId:a,role:'operador'},
    {nome:'TITULAR TESTE B',email:'titular-b@example.invalid',senha:randomUUID(),clienteId:b,role:'admin'},
    {nome:'REVISOR TESTE',email:'revisor@example.invalid',senha:randomUUID(),clienteId:central,role:'admin'}]);
  await Promise.all(Object.values(mongoose.models).map(m=>m.init()));
  const users=Object.fromEntries(pessoas.map(u=>[String(u._id),u]));
  const app=express();app.use(express.json());
  app.use((req,res,next)=>{const u=users[req.get('x-test-user')];if(u)req.user={id:u._id,clienteId:u.clienteId,role:u.role,email:u.email};next();});
  app.use('/api',require('../src/middlewares/acessosMiddleware').controlarAcessos);
  app.use('/api/familia',web);app.use('/api/familia-dispositivo',aparelho);
  const servidor=app.listen(0,'127.0.0.1');await new Promise(r=>servidor.once('listening',r));
  let verificacoes=0;
  const checar=(cond,msg)=>{assert.ok(cond,msg);verificacoes++;};
  const req=async(path,{user,token,body,method=body?'POST':'GET'}={})=>{
    const resposta=await fetch('http://127.0.0.1:'+servidor.address().port+'/api/'+path,{method,headers:{'Content-Type':'application/json',...(user?{'x-test-user':String(user._id)}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:resposta.status,...await resposta.json()};
  };
  const [ua,ub,revisor]=pessoas;
  try {
    checar((await req('familia')).status===401,'Visita sem login deve ser recusada');
    for(const u of [ua,ub,revisor])checar((await req('familia/responsavel',{user:u,body:{nome:u.nome,nascimento:'1990-01-01',contato:'61900000000',clienteId:String(b)}})).status===200,'Cadastro de responsável de teste');
    const nasc=(new Date().getUTCFullYear()-10)+'-01-01';
    const criado=await req('familia/menores',{user:ua,body:{nome:'MENOR SINTETICO',nascimento:nasc,vinculo:'pai',usuarioId:String(ub._id),clienteId:String(b)}});
    checar(criado.status===200,'Cadastro sintético do menor');const mid=criado.dados._id;
    checar(String((await Pessoa.findById(mid)).usuarioId)===String(ua._id),'Proprietário vem da sessão');
    const quadro=await req('familia',{user:ua}),termo=quadro.dados.termo;
    checar((await req('familia/menores/'+mid+'/codigo',{user:ua,body:{}})).status===403,'Código bloqueado antes das verificações');
    checar((await req('familia/menores/'+mid+'/autorizar',{user:ua,body:{aceito:true,cienteMenor:true,versao:'antiga',hash:termo.hash}})).status===400,'Termo antigo recusado');
    checar((await req('familia/menores/'+mid+'/autorizar',{user:ua,body:{aceito:true,cienteMenor:true,versao:termo.versao,hash:termo.hash}})).status===200,'Aceite sintético para teste');
    checar((await req('familia/menores/'+mid+'/codigo',{user:ua,body:{}})).status===403,'Aceite sozinho não libera código');
    checar((await req('familia/verificacoes',{user:ua})).status===403,'Titular não acessa revisão');
    checar((await req('familia/VERIFICACOES',{user:ua})).status===403,'Maiúsculas não contornam a autorização da revisão');
    checar((await req('familia/menores/'+mid+'/historico',{user:ub})).status===404,'Outra conta não acessa cadastro');
    const ra=await Responsavel.findOne({usuarioId:ua._id}),rr=await Responsavel.findOne({usuarioId:revisor._id});
    const prova={decisao:'verificado',identidade:true,maioridade:true,contato:true,vinculo:true,referencia:'AUTOTESTE SINTETICO - SEM PESSOAS REAIS'};
    checar((await req('familia/verificacoes/responsavel/'+rr._id,{user:revisor,body:prova})).status===403,'Revisor não aprova a própria identidade');
    checar((await req('familia/verificacoes/responsavel/'+ra._id,{user:revisor,body:prova})).status===200,'Conferência sintética do responsável');
    checar((await req('familia/verificacoes/menor/'+mid,{user:revisor,body:{...prova,vinculo:false}})).status===400,'Conferência sem vínculo recusada');
    checar((await req('familia/verificacoes/menor/'+mid,{user:revisor,body:prova})).status===200,'Conferência sintética do vínculo');
    // Autorização adicional do app: o aceite da página web não amplia a coleta.
    const codigoApp=await req('familia/menores/'+mid+'/codigo',{user:ua,body:{}});
    delete process.env.FAMILIA_APP_HABILITADO;
    checar((await req('familia-dispositivo/app-info')).dados.appDisponivel===false,'App fechado por padrão');
    const pedidoApp={codigo:codigoApp.dados.codigo,nomeAparelho:'APP SINTETICO',modalidade:'app'};
    checar((await req('familia-dispositivo/parear',{body:pedidoApp})).status===426,'App desligado não consome código');
    process.env.FAMILIA_APP_HABILITADO='1';
    checar((await req('familia-dispositivo/parear',{body:pedidoApp})).status===403,'Termo web não autoriza app');
    const termoApp=(await req('familia',{user:ua})).dados.termoApp;
    const aceiteApp={aceito:true,cienteMenor:true,versao:termoApp.versao,hash:termoApp.hash};
    checar((await req('familia/menores/'+mid+'/autorizar-app',{user:ub,body:aceiteApp})).status===404,'Outra conta não autoriza app');
    checar((await req('familia/menores/'+mid+'/autorizar-app',{user:ua,body:{...aceiteApp,hash:'antigo'}})).status===400,'Hash antigo do termo app recusado');
    checar((await req('familia/menores/'+mid+'/autorizar-app',{user:ua,body:aceiteApp})).status===200,'Aceite adicional sintético do app');
    const appPareado=await req('familia-dispositivo/parear',{body:pedidoApp});
    checar(appPareado.status===200,'App pareado após aprovação e autorização adicional');
    const tokenApp=appPareado.dados.token;
    checar((await req('familia-dispositivo/status',{token:tokenApp})).dados.autorizacaoApp===true,'App reconhece autorização própria');
    checar((await req('familia-dispositivo/iniciar',{token:tokenApp,body:{}})).status===200,'App inicia explicitamente');
    const pontoApp={mensagemId:'app-sintetico',latitude:0,longitude:0,precisao:10,dataHora:new Date(Date.now()+1000).toISOString()};
    checar((await req('familia-dispositivo/posicoes',{token:tokenApp,body:{pontos:[pontoApp]}})).dados.novas===1,'App envia ao mesmo histórico privado');
    delete process.env.FAMILIA_APP_HABILITADO;
    checar((await req('familia-dispositivo/status',{token:tokenApp})).status===426,'Desligamento da função bloqueia o app');
    checar((await req('familia-dispositivo/pausar',{token:tokenApp,body:{}})).status===200,'Pausa permanece acessível com app desligado');
    await Posicao.deleteMany({menorId:mid}); // Somente pontos sintéticos deste banco descartável.
    process.env.FAMILIA_APP_HABILITADO='1';
    const codigo=await req('familia/menores/'+mid+'/codigo',{user:ua,body:{}});checar(codigo.status===200,'Emissão de código temporário');
    checar((await req('familia-dispositivo/status',{token:tokenApp})).status===401,'Novo código invalida o app anterior');
    const pares=await Promise.all([1,2].map(()=>req('familia-dispositivo/parear',{body:{codigo:codigo.dados.codigo,nomeAparelho:'APARELHO SINTETICO'}})));
    checar(pares.filter(p=>p.status===200).length===1,'Código consumido uma única vez em concorrência');
    const token=pares.find(p=>p.status===200).dados.token;
    const salvo=await Pessoa.findById(mid).select('+tokenHash +codigoHash');
    checar(salvo.tokenHash!==token&&!salvo.codigoHash,'Token em hash; código removido');
    checar((await req('familia-dispositivo/posicoes',{token,body:{pontos:[]}})).status===409,'Aparelho pareado começa interrompido');
    checar((await req('familia-dispositivo/iniciar',{token,body:{}})).status===200,'Compartilhamento inicia explicitamente');
    const ponto={mensagemId:'ponto-1',latitude:0,longitude:0,precisao:10,velocidade:0,dataHora:new Date(Date.now()+1000).toISOString()};
    const enviar=body=>req('familia-dispositivo/posicoes',{token,body});
    checar((await enviar({pontos:[ponto]})).dados.novas===1,'Posição sintética aceita');
    checar((await enviar({pontos:[{...ponto,latitude:20}]})).dados.novas===0,'Reenvio deduplicado');
    checar((await Pessoa.findById(mid)).ultimaPosicao.latitude===0,'Reenvio não altera a coordenada armazenada');
    const novo={...ponto,mensagemId:'ponto-2',latitude:1,dataHora:new Date(Date.now()+2000).toISOString()};await enviar({pontos:[novo]});await enviar({pontos:[ponto]});
    checar((await Pessoa.findById(mid)).ultimaPosicao.latitude===1,'Última posição não retrocede');
    const outro=await req('familia',{user:ub});checar(outro.dados.pessoas.length===0,'Outra conta não vê menores');
    const historico=await req('familia/menores/'+mid+'/historico',{user:ua});checar(historico.dados.posicoes.length===2,'Titular consulta o histórico');
    checar(await Auditoria.exists({usuarioId:ua._id,acao:'consulta_localizacao'}),'Consulta auditada');
    const revisao=await req('familia/verificacoes?estado=todos',{user:revisor});checar(!JSON.stringify(revisao).includes('latitude')&&!JSON.stringify(revisao).includes('tokenHash'),'Revisão não expõe localização nem credenciais');
    await req('familia-dispositivo/pausar',{token,body:{}});
    checar((await enviar({pontos:[{...novo,mensagemId:'pausado'}]})).status===409,'Pausa impede posições');
    await req('familia-dispositivo/iniciar',{token,body:{}});
    await Posicao.create({menorId:mid,geracao:salvo.geracao,clienteId:a,usuarioId:ua._id,mensagemId:'expirado',latitude:50,longitude:50,precisao:10,dataHora:new Date(Date.now()-15*86400000),expiraEm:new Date(Date.now()-1000)});
    const hist2=await req('familia/menores/'+mid+'/historico',{user:ua});checar(!hist2.dados.posicoes.some(p=>p.latitude===50),'Leitura ignora dados expirados antes da limpeza TTL');
    const corrida=await Promise.all([enviar({pontos:[{...novo,mensagemId:'concorrente',dataHora:new Date(Date.now()+3000).toISOString()}]}),req('familia/menores/'+mid+'/revogar',{user:ua,body:{}})]);
    checar(corrida[1].status===200,'Revogação aceita durante ingestão');
    checar(await Posicao.countDocuments({menorId:mid})===0,'Revogação remove posições inclusive em corrida com ingestão');
    checar((await req('familia-dispositivo/status',{token})).status===401,'Token anterior revogado');
    const privado=await req('familia',{user:ua});checar(!privado.dados.pessoas[0].ultimaPosicao,'Sem localização após revogação');
    checar((await req('familia/menores/'+mid,{user:ua,method:'DELETE'})).status===200,'Exclusão sintética');
    checar(!await Pessoa.exists({_id:mid}),'Cadastro removido');
    console.log('FAMILIA_AUTOTESTE_OK verificacoes='+verificacoes+' banco_descartavel=true');
  } finally {
    await new Promise(r=>servidor.close(r));
    // Só o banco local descartável previamente validado pode ser limpo.
    if(/^linktrac_familia_teste_[a-z0-9_]+$/.test(mongoose.connection.name))await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}
main().catch(async e=>{console.error('FAMILIA_AUTOTESTE_FALHOU codigo='+(e.code||'verificacao')+' etapa='+(e.name==='AssertionError'?e.message:'ambiente_ou_execucao'));await mongoose.disconnect().catch(()=>{});process.exitCode=1;});
