// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, fireEvent, cleanup } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { me } from '../api/auth';
vi.mock('../api/auth', () => ({ me: vi.fn(), login: vi.fn(), register: vi.fn() }));
function Session() {
  const { user, loading, sessionError, retrySession, logout } = useAuth();
  return (
    <>
      <span>{loading ? 'carregando' : user?.nome || 'sem usuário'}</span>
      <p>{sessionError}</p>
      <button onClick={retrySession}>repetir</button>
      <button onClick={logout}>sair</button>
    </>
  );
}
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.resetAllMocks();
});
describe('recuperação de sessão', () => {
  it('preserva o token em falha temporária e permite repetir a consulta', async () => {
    localStorage.setItem('token', 'token-teste');
    me.mockRejectedValueOnce({ status: 503 }).mockResolvedValueOnce({ dados: { nome: 'Maria' } });
    render(
      <AuthProvider>
        <Session />
      </AuthProvider>
    );
    await screen.findByText('Não foi possível verificar sua sessão. Tente novamente.');
    expect(localStorage.getItem('token')).toBe('token-teste');
    fireEvent.click(screen.getByText('repetir'));
    await screen.findByText('Maria');
    expect(me).toHaveBeenCalledTimes(2);
  });
  it('remove a sessão quando o token é recusado', async () => {
    localStorage.setItem('token', 'expirado');
    me.mockRejectedValue({ status: 401 });
    render(
      <AuthProvider>
        <Session />
      </AuthProvider>
    );
    await screen.findByText('sem usuário');
    expect(localStorage.getItem('token')).toBeNull();
  });
  it('não restaura o usuário quando a consulta termina após sair', async () => {
    localStorage.setItem('token', 'token-teste');
    let resolve;
    me.mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );
    render(
      <AuthProvider>
        <Session />
      </AuthProvider>
    );
    fireEvent.click(screen.getByText('sair'));
    resolve({ dados: { nome: 'Maria' } });
    await waitFor(() => expect(screen.getByText('sem usuário')).toBeDefined());
    expect(screen.queryByText('Maria')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });
});
