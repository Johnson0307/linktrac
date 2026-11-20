const express = require('express');
const mongoose = require('mongoose');
const { randomBytes, randomUUID } = require('node:crypto');
const { Responsavel, Pessoa, Posicao, Auditoria, Limite } = require('./modelos');
const R = require('./regras');
const A = require('./app');
const { authenticate } = require('../middlewares/authMiddleware');
const { adminDaLinktrac } = require('../middlewares/linktracMiddleware');
const { permite } = require('../services/acessosCliente');
const { escopoEmpresa } = require('../services/carteiraRevenda');
const Usuario = require('../models/Usuario');
const Cliente = require('../models/Cliente');
const { id } = require('../operacao/validacao');
const web = express.Router(), aparelho = express.Router();
aparelho.use((req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
const escopo = req => ({ clienteId: req.user.clienteId, usuarioId: req.user.id });
const seguro = fn => async (req,res) => {
  res.set('Cache-Control','private, no-store');
  try { res.json({ sucesso:true, dados:await fn(req) }); }
  catch(e) { res.status(e.code === 11000 ? 409 : e.status || 503).json({ sucesso:false,
    mensagem:e.code === 11000 ? 'Cadastro já existente ou operação concorrente. Atualize e tente novamente.' : e.status ? e.message : 'Não foi possível concluir a operação de Pessoas e família.' }); }
};
async function auditar(dados,session) { await Auditoria.create([dados],session?{session}:{}); }
async function dono(req,session) {
  let q=Responsavel.findOne(escopo(req)); if(session)q=q.session(session);
  const r=await q; if(!r)R.falhar('Cadastre o responsável primeiro.',409); return r;
}
async function filho(req,session) {
  if(!id(req.params.id))R.falhar('Cadastro inválido.');
  let q=Pessoa.findOne({_id:req.params.id,...escopo(req)});if(session)q=q.session(session);
  const p=await q;if(!p)R.falhar('Cadastro não encontrado.',404);return p;
}
async function limite(chave,maximo) {
  const agora=Date.now(),janela=Math.floor(agora/60000);
  let registro;
  try{registro=await Limite.findOneAndUpdate({chave:R.hash(chave),janela},{$inc:{quantidade:1},$setOnInsert:{expiraEm:new Date(agora+120000)}},{upsert:true,new:true});}
  catch(e){if(e.code!==11000)throw e;registro=await Limite.findOneAndUpdate({chave:R.hash(chave),janela},{$inc:{quantidade:1}},{new:true});}
  if(!registro||registro.quantidade>maximo)R.falhar('Limite de tentativas atingido. Aguarde um minuto.',429);
}
web.use(authenticate);
web.use((req,res,next)=>{
  res.set('Cache-Control','private, no-store');
  if(/^\/verificacoes(?:\/|$)/i.test(req.path))return adminDaLinktrac(req.user)?next():res.status(403).json({sucesso:false,mensagem:'Análise restrita à administração Linktrac.'});
  if(!permite(req.user.acessos,'familia',req.method!=='GET'))return res.status(403).json({sucesso:false,mensagem:'Pessoas e família não está liberado para sua empresa.'});
  next();
});
web.get('/',seguro(async req=>{
  const [r,pessoas]=await Promise.all([Responsavel.findOne(escopo(req)).lean(),Pessoa.find(escopo(req)).sort({createdAt:-1}).limit(50).lean()]);
  const publicas=pessoas.map(p=>R.pessoaPublica(p,r));
  const consultas=publicas.filter(p=>p.ultimaPosicao);
  if(consultas.length)await Auditoria.insertMany(consultas.map(p=>({...escopo(req),menorId:p._id,por:req.user.id,acao:'consulta_mapa'})));
  return {responsavel:r?{_id:r._id,nome:r.nome,nascimento:r.nascimento,contato:r.contato,verificacao:r.verificacao.estado}:null,
    pessoas:publicas.map((p,i)=>({...p,autorizacaoApp:A.autorizadoApp(pessoas[i])})),termo:R.termo,
    termoApp:A.termoApp,appDisponivel:A.appDisponivel(),podeAnalisar:adminDaLinktrac(req.user)};
}));
web.post('/responsavel',seguro(async req=>{
  const dados=R.validarResponsavel(req.body);
  return mongoose.connection.transaction(async session=>{
    const [r]=await Responsavel.create([{...escopo(req),...dados}],{session});
    await auditar({...escopo(req),responsavelId:r._id,por:req.user.id,acao:'cadastro_responsavel'},session);
    return {verificacao:'pendente'};
  });
}));
web.post('/menores',seguro(async req=>{
  const dados=R.validarMenor(req.body);
  return mongoose.connection.transaction(async session=>{
    const r=await dono(req,session);
    // A escrita no responsável serializa o limite de cadastros por conta.
    await Responsavel.updateOne({_id:r._id},{$inc:{revisaoCadastros:1}},{session});
    if(await Pessoa.countDocuments(escopo(req)).session(session)>=20)R.falhar('Limite de 20 cadastros por conta atingido.',409);
    const [p]=await Pessoa.create([{...escopo(req),responsavelId:r._id,...dados}],{session});
    await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:'cadastro_menor'},session);
    return {_id:p._id,verificacao:'pendente'};
  });
}));
web.post('/menores/:id/autorizar',seguro(async req=>{
  if(req.body?.aceito!==true||req.body?.cienteMenor!==true||req.body?.versao!==R.termo.versao||req.body?.hash!==R.termo.hash)R.falhar('Leia o termo atual e confirme a autorização e a explicação ao menor.');
  return mongoose.connection.transaction(async session=>{
    const r=await dono(req,session),p=await filho(req,session);
    if(R.idade(r.nascimento)<18||R.idade(p.nascimento)>=18)R.falhar('Confira a idade e a modalidade do cadastro.',409);
    if(p.consentimento?.aceitoEm&&!p.consentimento?.revogadoEm&&p.consentimento.versao===R.termo.versao)return {autorizacaoRegistrada:true};
    p.consentimento={versao:R.termo.versao,hash:R.termo.hash,aceitoEm:new Date(),por:req.user.id};
    p.geracao=randomUUID();p.tokenHash=undefined;p.codigoHash=undefined;p.ultimaPosicao=undefined;p.pausado=true;
    await p.save({session});
    await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:'aceite_termo',versao:R.termo.versao,hash:R.termo.hash},session);
    return {autorizacaoRegistrada:true,pareamentoDependeDeVerificacao:true};
  });
}));
web.post('/menores/:id/autorizar-app',seguro(async req=>{
  if(!A.appDisponivel())R.falhar('O aplicativo ainda está em preparação para testes.',426);
  if(req.body?.aceito!==true||req.body?.cienteMenor!==true||req.body?.versao!==A.termoApp.versao||req.body?.hash!==A.termoApp.hash)R.falhar('Leia e aceite a autorização específica do aplicativo.');
  return mongoose.connection.transaction(async session=>{
    const r=await dono(req,session),p=await filho(req,session);R.exigirAutorizacao(r,p);
    p.consentimentoApp={versao:A.termoApp.versao,hash:A.termoApp.hash,aceitoEm:new Date(),por:req.user.id};
    await p.save({session});
    await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:'aceite_app',versao:A.termoApp.versao,hash:A.termoApp.hash},session);
    return {autorizacaoAppRegistrada:true};
  });
}));
web.post('/menores/:id/codigo',seguro(async req=>{
  await limite('codigo:'+req.user.id,5);
  return mongoose.connection.transaction(async session=>{
    const r=await dono(req,session),p=await filho(req,session);R.exigirAutorizacao(r,p);
    const codigo=randomBytes(6).toString('hex').toUpperCase();
    p.codigoHash=R.hash(codigo);p.codigoExpiraEm=new Date(Date.now()+15*60000);p.geracao=randomUUID();
    p.tokenHash=undefined;p.tokenExpiraEm=undefined;p.pareadoEm=undefined;p.aparelhoNome=undefined;p.ultimaPosicao=undefined;p.pausado=true;
    await p.save({session});await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:'novo_codigo'},session);
    return {codigo:codigo.match(/.{4}/g).join('-'),expiraEm:p.codigoExpiraEm,endereco:'/pessoas/aparelho'};
  });
}));
web.get('/menores/:id/historico',seguro(async req=>{
  const r=await dono(req),p=await filho(req);R.exigirAutorizacao(r,p);
  await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:'consulta_localizacao'});
  const agora=new Date();
  const registros=await Posicao.find({...escopo(req),menorId:p._id,expiraEm:{$gt:agora},dataHora:{$gte:new Date(Date.now()-14*86400000)}})
    .select('latitude longitude precisao velocidade dataHora -_id').sort({dataHora:-1,_id:-1}).limit(501).lean();
  return {menorId:String(p._id),nome:p.nome,posicoes:registros.slice(0,500).reverse(),limitado:registros.length>500};
}));
async function revogar(req,excluir=false){
  return mongoose.connection.transaction(async session=>{
    const p=await filho(req,session);
    p.consentimento.revogadoEm=new Date();p.geracao=randomUUID();p.tokenHash=undefined;p.codigoHash=undefined;
    p.tokenExpiraEm=undefined;p.codigoExpiraEm=undefined;p.ultimaPosicao=undefined;p.pausado=true;
    await p.save({session});await Posicao.deleteMany({menorId:p._id,...escopo(req)},{session});
    await auditar({...escopo(req),menorId:p._id,por:req.user.id,acao:excluir?'exclusao_menor':'revogacao'},session);
    if(excluir)await Pessoa.deleteOne({_id:p._id,...escopo(req)},{session});
    return {revogado:true,excluido:excluir};
  });
}
web.post('/menores/:id/revogar',seguro(req=>revogar(req)));
web.delete('/menores/:id',seguro(req=>revogar(req,true)));
const somenteAnalise=(req,res,next)=>adminDaLinktrac(req.user)?next():res.status(403).json({sucesso:false,mensagem:'Análise restrita à administração Linktrac.'});
web.get('/verificacoes',somenteAnalise,seguro(async req=>{
  await auditar({clienteId:req.user.clienteId,usuarioId:req.user.id,por:req.user.id,acao:'consulta_verificacoes'});
  const filtro=req.query.estado==='todos'?{}:{'verificacao.estado':{$ne:'verificado'}};
  const [responsaveis,menores]=await Promise.all([
    Responsavel.find(filtro).select('_id clienteId usuarioId nome nascimento contato verificacao').limit(100).lean(),
    Pessoa.find(filtro).select('_id clienteId usuarioId responsavelId nome nascimento vinculo verificacao').limit(100).lean(),
  ]);
  // Nenhum token ou coordenada é entregue para análise cadastral.
  const pais=await Responsavel.find({_id:{$in:menores.map(p=>p.responsavelId)}}).select('_id nome contato').lean();
  return {responsaveis,menores:menores.map(p=>({...p,responsavelResumo:pais.find(r=>String(r._id)===String(p.responsavelId))}))};
}));
web.post('/verificacoes/:tipo/:id',somenteAnalise,seguro(async req=>{
  if(!id(req.params.id)||!['responsavel','menor'].includes(req.params.tipo))R.falhar('Análise inválida.');
  const aprovado=req.body?.decisao==='verificado',suspenso=req.body?.decisao==='suspenso';
  if(!aprovado&&!suspenso)R.falhar('Informe aprovar ou suspender.');
  const referencia=R.campo(req.body?.referencia,'a referência da conferência',200);
  if(aprovado&&((req.params.tipo==='responsavel'&&(req.body.identidade!==true||req.body.maioridade!==true||req.body.contato!==true))||
    (req.params.tipo==='menor'&&req.body.vinculo!==true)))R.falhar('Conclua as verificações necessárias antes de aprovar.');
  return mongoose.connection.transaction(async session=>{
    const Model=req.params.tipo==='responsavel'?Responsavel:Pessoa;
    const doc=await Model.findById(req.params.id).session(session);if(!doc)R.falhar('Cadastro não encontrado.',404);
    if(String(doc.usuarioId)===String(req.user.id))R.falhar('A conferência precisa ser realizada por outro administrador autorizado.',403);
    if(aprovado) {
      if(req.params.tipo==='responsavel'&&R.idade(doc.nascimento)<18)R.falhar('Responsável sem maioridade.',409);
      if(req.params.tipo==='menor'&&R.idade(doc.nascimento)>=18)R.falhar('Acompanhado já atingiu a maioridade.',409);
    }
    doc.verificacao={estado:aprovado?'verificado':'suspenso',por:req.user.id,em:new Date(),referencia};
    await doc.save({session});
    if(suspenso){
      const filtro=req.params.tipo==='menor'?{_id:doc._id}:{responsavelId:doc._id};
      const pessoas=await Pessoa.find(filtro).select('_id').session(session).lean();
      await Pessoa.updateMany(filtro,{$unset:{tokenHash:'',codigoHash:'',ultimaPosicao:''},$set:{pausado:true}},{session});
      await Posicao.deleteMany({menorId:{$in:pessoas.map(p=>p._id)}},{session});
    }
    await auditar({clienteId:doc.clienteId,usuarioId:doc.usuarioId,por:req.user.id,
      ...(req.params.tipo==='menor'?{menorId:doc._id}:{responsavelId:doc._id}),acao:'analise_'+req.params.tipo+'_'+doc.verificacao.estado},session);
    return {estado:doc.verificacao.estado};
  });
}));
async function elegivel(p,session){
  let qr=Responsavel.findById(p.responsavelId),qu=Usuario.exists({_id:p.usuarioId,clienteId:p.clienteId,ativo:{$ne:false}}),qc=Cliente.findById(p.clienteId).select('acessos tipo ativo revendedoraId');
  if(session){qr=qr.session(session);qu=qu.session(session);qc=qc.session(session);}
  const [r,u,c]=session?[await qr,await qu,await qc]:await Promise.all([qr,qu,qc]);R.exigirAutorizacao(r,p);
  const esc=await escopoEmpresa(c);if(!u||!esc||!permite(esc.acessos,'familia',true))R.falhar('Acompanhamento indisponível.',403);
  return r;
}
aparelho.get('/app-info',seguro(async()=>({appDisponivel:A.appDisponivel(),versaoProtocolo:1})));
aparelho.post('/parear',seguro(async req=>{
  await limite('parear:'+req.ip,20);
  const modalidade=req.body?.modalidade??'web';
  if(!['web','app'].includes(modalidade))R.falhar('Modalidade de aparelho inválida.');
  const codigo=typeof req.body?.codigo==='string'?req.body.codigo.replace(/-/g,'').toUpperCase():'';
  if(!/^[A-F0-9]{12}$/.test(codigo))R.falhar('Código inválido ou expirado.');
  const nome=R.campo(req.body?.nomeAparelho,'o nome do aparelho',80);
  return mongoose.connection.transaction(async session=>{
    const agora=new Date();const p=await Pessoa.findOne({codigoHash:R.hash(codigo),codigoExpiraEm:{$gt:agora},ativo:true}).session(session);
    if(!p)R.falhar('Código inválido ou expirado.');await elegivel(p,session);
    if(modalidade==='app')A.exigirApp(p);
    const token=randomBytes(32).toString('hex');
    const atualizado=await Pessoa.findOneAndUpdate({_id:p._id,codigoHash:R.hash(codigo),codigoExpiraEm:{$gt:agora}},
      {$set:{tokenHash:R.hash(token),tokenExpiraEm:new Date(Date.now()+90*86400000),aparelhoNome:nome,aparelhoModo:modalidade,pareadoEm:agora,pausado:true},$unset:{codigoHash:'',codigoExpiraEm:''}},{session,new:true});
    if(!atualizado)R.falhar('Código já utilizado.',409);
    await auditar({clienteId:p.clienteId,usuarioId:p.usuarioId,menorId:p._id,acao:'pareamento'},session);
    return {token,nome:p.nome.split(' ')[0],aviso:'Compartilhamento com o responsável. A localização só começa após tocar em Iniciar e permitir o GPS.'};
  });
}));
async function autenticarAparelho(req,res,next){
  try{
    const token=req.headers.authorization?.match(/^Bearer ([a-f0-9]{64})$/i)?.[1];if(!token)R.falhar('Aparelho não autorizado.',401);
    const p=await Pessoa.findOne({tokenHash:R.hash(token),tokenExpiraEm:{$gt:new Date()},ativo:true}).select('+tokenHash');
    if(!p)R.falhar('Aparelho não autorizado. Solicite novo pareamento.',401);
    await elegivel(p);
    // Pausar/desparear continuam disponíveis mesmo quando o módulo nativo é desligado.
    if(p.aparelhoModo==='app'&&!['/pausar','/desparear'].includes(req.path.toLowerCase()))A.exigirApp(p);
    await limite('aparelho:'+p._id,60);req.pessoaFamilia=p;next();
  }catch(e){res.status(e.status||503).json({sucesso:false,mensagem:e.status?e.message:'Não foi possível verificar a autorização.'});}
}
aparelho.use(autenticarAparelho);
aparelho.get('/status',seguro(async req=>({nome:req.pessoaFamilia.nome.split(' ')[0],pausado:req.pessoaFamilia.pausado,
  appDisponivel:A.appDisponivel(),autorizacaoApp:req.pessoaFamilia.aparelhoModo==='app'&&A.autorizadoApp(req.pessoaFamilia),
  retencaoDias:14,aviso:'Seu responsável pode consultar a localização compartilhada. Você pode interromper o compartilhamento neste aparelho.'})));
aparelho.post('/iniciar',seguro(async req=>{
  const p=req.pessoaFamilia;
  const existente=await Pessoa.findOne({_id:p._id,tokenHash:p.tokenHash,ativo:true});
  if(!existente)R.falhar('Autorização alterada. Faça novo pareamento.',401);
  if(!existente.pausado)return {ativo:true};
  const atualizado=await Pessoa.findOneAndUpdate({_id:p._id,tokenHash:p.tokenHash,ativo:true,pausado:true},
    {$set:{pausado:false,inicioCompartilhamentoEm:new Date()}},{new:true});
  if(!atualizado)R.falhar('Estado alterado. Atualize o aparelho.',409);
  await auditar({clienteId:p.clienteId,usuarioId:p.usuarioId,menorId:p._id,acao:'inicio_compartilhamento'});
  return {ativo:true};
}));
aparelho.post('/pausar',seguro(async req=>{
  const p=req.pessoaFamilia;
  await Pessoa.updateOne({_id:p._id,tokenHash:p.tokenHash},{$set:{pausado:true},$unset:{ultimaPosicao:''}});
  await auditar({clienteId:p.clienteId,usuarioId:p.usuarioId,menorId:p._id,acao:'pausa_aparelho'});
  return {pausado:true};
}));
aparelho.post('/desparear',seguro(async req=>{
  const p=req.pessoaFamilia;
  await Pessoa.updateOne({_id:p._id,tokenHash:p.tokenHash},{$set:{pausado:true,geracao:randomUUID()},$unset:{tokenHash:'',tokenExpiraEm:'',ultimaPosicao:'',pareadoEm:'',aparelhoNome:''}});
  await auditar({clienteId:p.clienteId,usuarioId:p.usuarioId,menorId:p._id,acao:'despareamento_aparelho'});
  return {despareado:true};
}));
aparelho.post('/posicoes',seguro(async req=>{
  const auth=req.pessoaFamilia;
  return mongoose.connection.transaction(async session=>{
    const p=await Pessoa.findOne({_id:auth._id,tokenHash:auth.tokenHash,geracao:auth.geracao,ativo:true,pausado:false}).session(session);
    if(!p)R.falhar('Compartilhamento interrompido ou pareamento alterado.',409);await elegivel(p,session);
    if(p.aparelhoModo==='app')A.exigirApp(p);
    const pontos=R.validarPontos(req.body,p);
    // Toda ingestão escreve no mesmo documento que a revogação/suspensão, evitando a corrida entre ambas.
    const bloqueio=await Pessoa.updateOne({_id:p._id,geracao:p.geracao,pausado:false},{$inc:{revisaoPosicoes:1},$set:{ultimaRecepcao:new Date()}},{session});
    if(!bloqueio.matchedCount)R.falhar('Compartilhamento interrompido.',409);
    const resultado=await Posicao.bulkWrite(pontos.map(ponto=>({updateOne:{
      filter:{menorId:p._id,geracao:p.geracao,mensagemId:ponto.mensagemId},
      update:{$setOnInsert:{...ponto,clienteId:p.clienteId,usuarioId:p.usuarioId,menorId:p._id,geracao:p.geracao}},upsert:true,
    }})),{session,ordered:true});
    const ultima=await Posicao.findOne({menorId:p._id,geracao:p.geracao,expiraEm:{$gt:new Date()},dataHora:{$gte:p.inicioCompartilhamentoEm}})
      .select('latitude longitude precisao velocidade dataHora recebidoEm expiraEm -_id').sort({dataHora:-1}).session(session).lean();
    if(ultima)await Pessoa.updateOne({_id:p._id},{$set:{ultimaPosicao:ultima}},{session});
    return {recebidas:pontos.length,novas:resultado.upsertedCount};
  });
}));
module.exports={web,aparelho,limite,elegivel,autenticarAparelho};
