// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import Configuracoes from './Configuracoes';
import api from '../api/api';import {useAuth} from '../contexts/AuthContext';
vi.mock('../api/api',()=>({default:{get:vi.fn(),put:vi.fn()}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks()});
const resposta={data:{dados:{limiteVelocidade:80},campos:{limiteVelocidade:{label:'Limite de velocidade',min:5,max:300,padrao:80}}}};
it('gestor grava o valor informado no servidor e recebe confirmação',async()=>{
 useAuth.mockReturnValue({user:{role:'gestor',clienteId:'a'}});api.get.mockResolvedValue(resposta);api.put.mockResolvedValue({data:{dados:{limiteVelocidade:90}}});
 render(<Configuracoes/>);fireEvent.change(await screen.findByLabelText('Limite de velocidade'),{target:{value:'90'}});fireEvent.click(screen.getByRole('button',{name:'Salvar configurações'}));
 await waitFor(()=>expect(api.put).toHaveBeenCalledWith('/operacao/configuracoes',{limiteVelocidade:90}));expect(await screen.findByRole('status')).toBeTruthy();
});
it('operador consulta sem botão de gravação',async()=>{useAuth.mockReturnValue({user:{role:'operador',clienteId:'a'}});api.get.mockResolvedValue(resposta);render(<Configuracoes/>);expect((await screen.findByLabelText('Limite de velocidade')).disabled).toBe(true);expect(screen.queryByRole('button',{name:'Salvar configurações'})).toBeNull();expect(api.put).not.toHaveBeenCalled();});
it('falha de carregamento não apresenta dados fictícios',async()=>{useAuth.mockReturnValue({user:{role:'admin'}});api.get.mockRejectedValue(new Error());render(<Configuracoes/>);expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByLabelText('Limite de velocidade')).toBeNull();});
