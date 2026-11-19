// @vitest-environment jsdom
import {afterEach,expect,it,vi} from 'vitest';
import {cleanup,render,screen,fireEvent,waitFor} from '@testing-library/react';
import TagsBle from './TagsBle';
import api from '../api/api';
import {useAuth} from '../contexts/AuthContext';
vi.mock('../api/api',()=>({default:{get:vi.fn(),post:vi.fn(),put:vi.fn()}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:vi.fn()}));
vi.mock('../componentes/layout/AcoesDaPagina',()=>({default:({children})=>children}));
vi.mock('../componentes/MapaTrajeto',()=>({default:()=>null}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('abre cadastro com situação a testar e salva identificação sem campos de outra empresa',async()=>{
 useAuth.mockReturnValue({user:{role:'admin',clienteId:'empresa1'}});
 api.get.mockResolvedValue({data:{dados:[],receptores:[],catalogo:[]}});api.post.mockResolvedValue({data:{sucesso:true}});
 render(<TagsBle/>);await screen.findByText('Cadastrar tag BLE');
 expect(screen.getByLabelText('Situação da homologação').value).toBe('a_testar');
 fireEvent.change(screen.getByLabelText('Nome da tag'),{target:{value:'Tag máquina'}});
 fireEvent.change(screen.getByLabelText('Bem, máquina ou equipamento identificado'),{target:{value:'Trator 1'}});
 fireEvent.change(screen.getByLabelText('Identificador da tag'),{target:{value:'AABBCCDDEEFF'}});
 fireEvent.click(screen.getByRole('button',{name:'Salvar tag'}));
 await waitFor(()=>expect(api.post).toHaveBeenCalled());
 expect(api.post.mock.calls[0][1]).not.toHaveProperty('clienteId');
});
it('consulta não exibe formulário de configuração',async()=>{
 useAuth.mockReturnValue({user:{role:'gestor',clienteId:'empresa1',acessos:{equipamentos:'consulta'}}});
 api.get.mockResolvedValue({data:{dados:[],receptores:[],catalogo:[]}});render(<TagsBle/>);
 await waitFor(()=>expect(api.get).toHaveBeenCalled());expect(screen.queryByText('Cadastrar tag BLE')).toBeNull();
});

