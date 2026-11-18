// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from './NavBar';
import { useAuth } from '../../contexts/AuthContext';
vi.mock('../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const abrir = (user) => { useAuth.mockReturnValue({ user, logout: vi.fn() }); return render(<MemoryRouter initialEntries={['/historicos']}><NavBar /></MemoryRouter>); };
it('usa o logo oficial e identifica a página atual', () => {
  abrir({ nome: 'Johnson', role: 'admin' });
  expect(screen.getByRole('img', { name: 'Linktrac — Rastreamento Veicular' }).getAttribute('src')).toContain('linktrac-logo.jpeg');
  expect(screen.getByRole('link', { name: 'Históricos' }).getAttribute('aria-current')).toBe('page');
  expect(screen.getByRole('link', { name: 'Usuários' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Espelhamentos' })).toBeNull();
});
it('preserva os menus de administração conforme o perfil', () => {
  const { unmount } = abrir({ nome: 'Operador', role: 'operador' });
  expect(screen.queryByRole('link', { name: 'Usuários' })).toBeNull(); unmount();
  abrir({ nome: 'Linktrac', role: 'admin', podeGerenciarEspelhamentos: true });
  expect(screen.getByRole('link', { name: 'Espelhamentos' })).toBeTruthy();
});
it('exibe os cinco atalhos de cadastro na ordem solicitada', () => {
  abrir({ nome: 'Administrador', role: 'admin' });
  const grupo = screen.getByText('Cadastros', { selector: 'summary' }).parentElement;
  expect(within(grupo).getAllByRole('link').map(link => link.textContent))
    .toEqual(['Clientes', 'Rastreadores', 'Câmeras', 'Veículos', 'Motoristas']);
  expect(within(grupo).getByRole('link', { name: 'Câmeras' }).getAttribute('href')).toBe('/cameras');
});
it.each([
  { role: 'gestor', acessos: { equipamentos: 'bloqueado' } },
  { role: 'operador', acessos: { equipamentos: 'configurar' } },
])('oculta Rastreadores sem acesso ao cadastro operacional', (user) => {
  abrir({ nome: 'Cliente', ...user });
  expect(screen.queryByRole('link', { name: 'Rastreadores' })).toBeNull();
  expect(screen.queryByRole('link', { name: 'Câmeras' })).toBeNull();
});
it('permite abrir e fechar a navegação móvel pelo teclado', () => {
  abrir({ nome: 'Johnson', role: 'admin' });
  const menu = screen.getByRole('button', { name: 'Abrir navegação' });
  fireEvent.click(menu); expect(menu.getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(window, { key: 'Escape' }); expect(menu.getAttribute('aria-expanded')).toBe('false');
});
it('encerra a sessão pelo botão Sair', () => {
  abrir({ nome: 'Johnson', role: 'admin' });
  const logout = useAuth.mock.results[0].value.logout;
  fireEvent.click(screen.getByRole('button', { name: 'Sair da plataforma' }));
  expect(logout).toHaveBeenCalledOnce();
});
