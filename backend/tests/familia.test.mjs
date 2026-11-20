import {afterEach,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),R=require('../src/familia/regras');
const empresa='507f1f77bcf86cd799439011',usuario='507f1f77bcf86cd799439012',rid='507f1f77bcf86cd799439013',revisor='507f1f77bcf86cd799439014';
const fixture=()=>{const v={estado:'verificado',por:revisor,em:new Date(),referencia:'Protocolo sintético'};const r={_id:rid,clienteId:empresa,usuarioId:usuario,nascimento:'1990-01-01',verificacao:v};const p={_id:'507f1f77bcf86cd799439015',clienteId:empresa,usuarioId:usuario,responsavelId:rid,nome:'TESTE',nascimento:(new Date().getUTCFullYear()-10)+'-01-01',ativo:true,verificacao:v,consentimento:{versao:R.termo.versao,hash:R.termo.hash,por:usuario,aceitoEm:new Date(Date.now()-60000)},pareadoEm:new Date(Date.now()-50000),inicioCompartilhamentoEm:new Date(Date.now()-10000),pausado:false};return {r,p};};
afterEach(()=>vi.restoreAllMocks());
it('idade usa o aniversário exato e rejeita datas inválidas',()=>{expect(R.idade('2008-11-21','2026-11-20')).toBe(17);expect(R.idade('2008-11-20','2026-11-20')).toBe(18);expect(()=>R.idade('2026-02-30')).toThrow();expect(()=>R.idade('2099-01-01')).toThrow();});
it('autodeclaração, termo antigo, revisor próprio e revogação não autorizam coleta',()=>{
 const {r,p}=fixture();expect(R.autorizado(r,p)).toBe(true);
 expect(R.autorizado({...r,verificacao:{estado:'verificado'}},p)).toBe(false);
 expect(R.autorizado({...r,verificacao:{...r.verificacao,por:usuario}},p)).toBe(false);
 expect(R.autorizado(r,{...p,consentimento:{...p.consentimento,hash:'antigo'}})).toBe(false);
 expect(R.autorizado(r,{...p,consentimento:{...p.consentimento,revogadoEm:new Date()}})).toBe(false);
 expect(R.autorizado(r,{...p,usuarioId:revisor})).toBe(false);expect(R.autorizado(r,{...p,clienteId:revisor})).toBe(false);
 expect(R.autorizado(r,{...p,nascimento:'2000-01-01'})).toBe(false);
});
it('cadastros não aceitam campos de aprovação ou proprietários enviados pelo navegador',()=>{
 const body={nome:'Teste',nascimento:'1990-01-01',contato:'(61) 90000-0000',verificacao:{estado:'verificado'},clienteId:revisor};
 expect(R.validarResponsavel(body)).toEqual({nome:'Teste',nascimento:'1990-01-01',contato:'61900000000'});
 expect(()=>R.validarMenor({...body,vinculo:'amigo'})).toThrow();
 expect(()=>R.validarResponsavel({...body,nascimento:(new Date().getUTCFullYear()-10)+'-01-01'})).toThrow('maioridade');
});
it('validação estrita de GPS evita null como zero e bloqueia pontos fora da autorização',()=>{
 const {p}=fixture(),pt={mensagemId:'um',latitude:0,longitude:0,precisao:10,dataHora:new Date().toISOString()};
 expect(R.validarPontos({pontos:[pt]},p)[0].latitude).toBe(0);
 expect(()=>R.validarPontos({pontos:[{...pt,latitude:null}]},p)).toThrow();
 expect(()=>R.validarPontos({pontos:[{...pt,velocidade:-1}]},p)).toThrow();
 expect(()=>R.validarPontos({pontos:[{...pt,dataHora:new Date(Date.now()-120000).toISOString()}]},p)).toThrow('autorização');
 expect(()=>R.validarPontos({pontos:[pt,pt]},p)).toThrow('repetido');
 expect(()=>R.validarPontos({pontos:Array(201).fill(pt)},p)).toThrow('200');
});
it('retenção é calculada pela coleta e não pelo reenvio',()=>{
 const {p}=fixture(),ts=new Date(Date.now()-1000).toISOString();const [pt]=R.validarPontos({pontos:[{mensagemId:'a',latitude:0,longitude:0,precisao:1,dataHora:ts}]},p);
 expect(+pt.expiraEm).toBe(Date.parse(ts)+14*86400000);
});
it('serialização nunca devolve credenciais e oculta localização expirada, pausada ou revogada',()=>{
 const {r,p}=fixture();p.tokenHash='segredo';p.codigoHash='codigo';p.ultimaPosicao={latitude:1,longitude:2,expiraEm:new Date(Date.now()+10000)};
 expect(R.pessoaPublica(p,r)).not.toHaveProperty('tokenHash');expect(R.pessoaPublica(p,r)).not.toHaveProperty('codigoHash');
 expect(R.pessoaPublica(p,r).ultimaPosicao.latitude).toBe(1);
 expect(R.pessoaPublica({...p,pausado:true},r).ultimaPosicao).toBeNull();
 expect(R.pessoaPublica({...p,ultimaPosicao:{...p.ultimaPosicao,expiraEm:new Date(0)}},r).ultimaPosicao).toBeNull();
});
