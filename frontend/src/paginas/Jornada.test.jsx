// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import Jornada from './Jornada';
import api from '../api/api';
import {useAuth} from '../contexts/AuthContext';
vi.mock('../api/api',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:vi.fn()}));
vi.mock('../componentes/layout/AcoesDaPagina',()=>({default:({children})=>children}));
const dados=()=>({conta:{provedor:'solides',nomeOutro:'',liberada:false,temToken:false,protecaoDisponivel:false,testeEstado:'nao_testado'},vinculos:[],motoristas:[],provedores:{solides:'Sólides Ponto / Tangerino',pontotel:'Pontotel',outro:'Outro fornecedor'}});
afterEach(()=>{cleanup();vi.resetAllMocks();});
async function abrir(user={role:'admin',clienteId:'a'}){useAuth.mockReturnValue({user});api.get.mockResolvedValue({data:{dados:dados()}});render(<Jornada/>);await screen.findByLabelText('Fornecedor de ponto');fireEvent.click(screen.getByText('Configuração do fornecedor'));}
it('mostra sincronização pendente, não solicita pontos e não permite teste sem token',async()=>{
 await abrir();expect(screen.getByText('Sincronização de marcações pendente.')).toBeTruthy();
 expect(screen.getByRole('button',{name:'Testar acesso inicial'}).disabled).toBe(true);
 expect(api.get).toHaveBeenCalledTimes(1);expect(api.get.mock.calls[0][0]).toBe('/jornada');
 expect(screen.getByLabelText('Token de integração').disabled).toBe(true);
});
it('permite testar token salvo sem declarar liberação comercial',async()=>{
 useAuth.mockReturnValue({user:{role:'admin',clienteId:'a'}});
 const d=dados();d.conta.temToken=true;d.conta.protecaoDisponivel=true;
 api.get.mockResolvedValue({data:{dados:d}});render(<Jornada/>);
 await screen.findByLabelText('Fornecedor de ponto');fireEvent.click(screen.getByText('Configuração do fornecedor'));
 expect(screen.getByRole('button',{name:'Testar acesso inicial'}).disabled).toBe(false);
 expect(screen.getByLabelText('O fornecedor liberou o acesso para esta empresa e as condições foram conferidas').checked).toBe(false);
});
it('configuração do lembrete informa limite web e não chama registro de ponto',async()=>{
 await abrir();api.put.mockResolvedValue({data:{dados:{}}});
 fireEvent.click(screen.getByText('Lembrete de ponto ao identificar o motorista'));
 fireEvent.click(screen.getByLabelText('Ativar lembrete na plataforma web'));
 fireEvent.click(screen.getByRole('button',{name:'Salvar lembrete'}));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/jornada/lembrete',{ativo:true}));
 expect(api.post).not.toHaveBeenCalled();
});
it('permite preparar outro fornecedor sem enviar token e sem afirmar conector disponível',async()=>{
 await abrir();api.put.mockResolvedValue({data:{dados:{}}});
 fireEvent.change(screen.getByLabelText('Fornecedor de ponto'),{target:{value:'outro'}});
 fireEvent.change(screen.getByLabelText('Nome do fornecedor'),{target:{value:'Sistema atual'}});
 expect(screen.queryByLabelText('Token de integração')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Salvar fornecedor'}));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/jornada/configuracao',{provedor:'outro',nomeOutro:'Sistema atual',liberada:false,token:''}));
});
it('gestor de consulta não configura credenciais nem vínculos',async()=>{
 useAuth.mockReturnValue({user:{role:'gestor',clienteId:'a',acessos:{operacao:'consulta'}}});api.get.mockResolvedValue({data:{dados:dados()}});render(<Jornada/>);
 await screen.findByText('Somente o administrador configura as credenciais do fornecedor.');
 expect(screen.queryByLabelText('Token de integração')).toBeNull();expect(screen.queryByRole('button',{name:'Salvar vínculo'})).toBeNull();
});
