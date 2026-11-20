// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor,act} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import PessoasFamilia from './PessoasFamilia';
import AparelhoFamilia from './AparelhoFamilia';
import api from '../api/api';
import {useAuth} from '../contexts/AuthContext';
vi.mock('../api/api',()=>({default:{get:vi.fn(),post:vi.fn(),delete:vi.fn()}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:vi.fn()}));
vi.mock('../componentes/layout/AcoesDaPagina',()=>({default:({children})=>children}));
vi.mock('../componentes/MapaTrajeto',()=>({default:()=> <p>Mapa sintético</p>}));
afterEach(()=>{cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();sessionStorage.clear();delete document.hidden;});
const resposta=dados=>({ok:true,status:200,json:async()=>({sucesso:true,dados})});
const user={id:'conta-a',clienteId:'empresa-a',nome:'TITULAR TESTE',role:'operador',acessos:{familia:'configurar'}};
const base=()=>({responsavel:{nome:'TITULAR TESTE',contato:'61900000000',verificacao:'pendente'},pessoas:[{_id:'menor-a',nome:'MENOR SINTETICO',nascimento:'2016-01-01',verificacao:'pendente',autorizado:false,consentimento:{},aparelho:{pausado:true},ultimaPosicao:null}],termo:{texto:'Termo sintético de autorização.',versao:'v1',hash:'hash-teste'},podeAnalisar:false});
it('sem conferência não libera pareamento e exige os dois aceites do termo',async()=>{
 useAuth.mockReturnValue({user});api.get.mockResolvedValue({data:{dados:base()}});
 render(<MemoryRouter><PessoasFamilia/></MemoryRouter>);await screen.findByText('MENOR SINTETICO');
 expect(screen.getByRole('button',{name:'Adicionar ou trocar aparelho'}).disabled).toBe(true);
 fireEvent.click(screen.getByRole('button',{name:'Ler e autorizar'}));
 const aceitar=screen.getByRole('button',{name:'Registrar autorização'});expect(aceitar.disabled).toBe(true);
 fireEvent.click(screen.getByLabelText(/Declaro o vínculo informado/));expect(aceitar.disabled).toBe(true);
 fireEvent.click(screen.getByLabelText(/Expliquei ou explicarei/));expect(aceitar.disabled).toBe(false);
 expect(api.post).not.toHaveBeenCalled();
});
it('consulta sem configurar não mostra cadastro nem ações de autorização',async()=>{
 useAuth.mockReturnValue({user:{...user,acessos:{familia:'consulta'}}});api.get.mockResolvedValue({data:{dados:base()}});
 render(<MemoryRouter><PessoasFamilia/></MemoryRouter>);await screen.findByText('MENOR SINTETICO');
 expect(screen.queryByRole('button',{name:'Ler e autorizar'})).toBeNull();expect(screen.queryByRole('button',{name:'Excluir cadastro'})).toBeNull();
});
it('app exige um aceite separado, sem marcar caixas automaticamente',async()=>{
 useAuth.mockReturnValue({user});const d=base();d.appDisponivel=true;d.termoApp={texto:'Termo adicional sintético de segundo plano.',versao:'app-v1',hash:'app-hash'};d.pessoas[0].autorizado=true;
 api.get.mockResolvedValue({data:{dados:d}});api.post.mockResolvedValue({data:{dados:{}}});api.post.mockClear();
 render(<MemoryRouter><PessoasFamilia/></MemoryRouter>);await screen.findByText('MENOR SINTETICO');
 fireEvent.click(screen.getByRole('button',{name:'Autorizar aplicativo em segundo plano'}));
 expect(screen.getByText(d.termoApp.texto)).toBeTruthy();expect(screen.getByRole('button',{name:'Registrar autorização'}).disabled).toBe(true);
 fireEvent.click(screen.getByLabelText(/Declaro o vínculo informado/));fireEvent.click(screen.getByLabelText(/Expliquei ou explicarei/));
 fireEvent.click(screen.getByRole('button',{name:'Registrar autorização'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalledWith('/familia/menores/menor-a/autorizar-app',{aceito:true,cienteMenor:true,versao:'app-v1',hash:'app-hash'}));
});
it('sem pareamento a página não solicita GPS nem envia localização',()=>{
 const geo={getCurrentPosition:vi.fn(),watchPosition:vi.fn(),clearWatch:vi.fn()};Object.defineProperty(navigator,'geolocation',{configurable:true,value:geo});
 vi.stubGlobal('fetch',vi.fn());render(<AparelhoFamilia/>);
 expect(screen.getByRole('button',{name:'Parear este aparelho'})).toBeTruthy();expect(geo.getCurrentPosition).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
});
it('GPS só inicia após ação explícita e interrompe quando a página fica oculta',async()=>{
 sessionStorage.setItem('linktrac-familia-aparelho','a'.repeat(64));
 let callback;const geo={getCurrentPosition:vi.fn(resolve=>resolve({coords:{}})),watchPosition:vi.fn(fn=>{callback=fn;return 42;}),clearWatch:vi.fn()};
 Object.defineProperty(navigator,'geolocation',{configurable:true,value:geo});
 vi.stubGlobal('fetch',vi.fn(async(url)=>resposta(url.endsWith('/status')?{nome:'TESTE',pausado:true}:{})));
 render(<AparelhoFamilia/>);await screen.findByText('TESTE');
 expect(geo.getCurrentPosition).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'Iniciar compartilhamento e permitir GPS'}));
 await waitFor(()=>expect(geo.watchPosition).toHaveBeenCalled());
 await act(async()=>callback({timestamp:Date.now(),coords:{latitude:0,longitude:0,accuracy:5,speed:null}}));
 await waitFor(()=>expect(fetch.mock.calls.some(([url])=>url.endsWith('/posicoes'))).toBe(true));
 const envio=fetch.mock.calls.find(([url])=>url.endsWith('/posicoes'));const ponto=JSON.parse(envio[1].body).pontos[0];
 expect(ponto).not.toHaveProperty('velocidade');expect(envio[1].headers.Authorization).toBe('Bearer '+'a'.repeat(64));
 Object.defineProperty(document,'hidden',{configurable:true,value:true});
 await act(async()=>fireEvent(document,new Event('visibilitychange')));
 expect(geo.clearWatch).toHaveBeenCalledWith(42);expect(screen.getByText('COMPARTILHAMENTO INTERROMPIDO')).toBeTruthy();
 expect(fetch.mock.calls.some(([url])=>url.endsWith('/pausar'))).toBe(true);
});
