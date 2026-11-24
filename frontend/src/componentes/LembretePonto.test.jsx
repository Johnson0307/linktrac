// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LembretePonto from './LembretePonto';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../api/api',()=>({default:{get:vi.fn(),post:vi.fn()}}));
vi.mock('../contexts/AuthContext',()=>({useAuth:vi.fn()}));
afterEach(()=>{cleanup();vi.resetAllMocks();});
it('não consulta lembretes para gestores ou módulo bloqueado',()=>{
 useAuth.mockReturnValue({user:{role:'admin'}});const vista=render(<LembretePonto/>);
 expect(api.get).not.toHaveBeenCalled();
 useAuth.mockReturnValue({user:{role:'motorista',acessos:{operacao:'bloqueado'}}});vista.rerender(<LembretePonto/>);
 expect(api.get).not.toHaveBeenCalled();
});
it('exibe aviso pessoal e dispensa sem registrar ponto',async()=>{
 useAuth.mockReturnValue({user:{role:'motorista',id:'m',clienteId:'a'}});
 api.get.mockResolvedValue({data:{dados:[{_id:'aviso',mensagem:'Motorista identificado no TESTE01',pontoUrl:'https://app.tangerino.com.br/Tangerino/'}]}});
 api.post.mockResolvedValue({data:{dados:{dispensado:true,pontoRegistrado:false}}});render(<LembretePonto/>);
 await screen.findByText('Confira seu ponto');
 expect(screen.getByText(/Este aviso não registra ponto/)).toBeTruthy();
 expect(screen.getByRole('link',{name:'Abrir Sólides Ponto'}).getAttribute('href')).toBe('https://app.tangerino.com.br/Tangerino/');
 fireEvent.click(screen.getByRole('button',{name:'Dispensar lembrete'}));
 await waitFor(()=>expect(screen.queryByText('Confira seu ponto')).toBeNull());
 expect(api.post).toHaveBeenCalledWith('/jornada/meus-lembretes/aviso/dispensar',{});
});
it('falha ao dispensar mantém o aviso disponível e não segue link arbitrário',async()=>{
 useAuth.mockReturnValue({user:{role:'motorista',id:'m',clienteId:'a'}});
 api.get.mockResolvedValue({data:{dados:[{_id:'aviso',mensagem:'Confira a entrada',pontoUrl:'https://outra.example/'}]}});
 api.post.mockRejectedValue(new Error());render(<LembretePonto/>);
 await screen.findByText('Confira seu ponto');expect(screen.queryByRole('link')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'Dispensar lembrete'}));
 await screen.findByRole('alert');expect(screen.getByText('Confira seu ponto')).toBeTruthy();
});
