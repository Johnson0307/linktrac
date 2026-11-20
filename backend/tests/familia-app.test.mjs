import {afterEach,expect,it} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),A=require('../src/familia/app');
const old=process.env.FAMILIA_APP_HABILITADO;
afterEach(()=>{if(old===undefined)delete process.env.FAMILIA_APP_HABILITADO;else process.env.FAMILIA_APP_HABILITADO=old;});
const p=()=>({usuarioId:'u',consentimento:{aceitoEm:new Date(1000)},consentimentoApp:{...A.termoApp,aceitoEm:new Date(2000),por:'u'}});
it('app tem liberação explícita e fica fechado por padrão',()=>{delete process.env.FAMILIA_APP_HABILITADO;expect(A.appDisponivel()).toBe(false);expect(()=>A.exigirApp(p())).toThrow('preparação');process.env.FAMILIA_APP_HABILITADO='1';expect(()=>A.exigirApp(p())).not.toThrow();});
it('termo web não autoriza app; alteração de hash, titular ou revogação bloqueia',()=>{expect(A.autorizadoApp({...p(),consentimentoApp:undefined})).toBe(false);expect(A.autorizadoApp(p())).toBe(true);for(const c of [{hash:'outro'},{por:'outro'},{versao:'antiga'},{aceitoEm:new Date(500)}])expect(A.autorizadoApp({...p(),consentimentoApp:{...p().consentimentoApp,...c}})).toBe(false);expect(A.autorizadoApp({...p(),consentimento:{...p().consentimento,revogadoEm:new Date()}})).toBe(false);});
