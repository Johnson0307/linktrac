// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ManualUso, { ConteudoManual } from './ManualUso';
import { manuais, secaoPorRota } from '../ajuda/manuais';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('mostra o cadastro detalhado de cada campo ao administrador e gestor da empresa', () => {
  for (const role of ['admin', 'gestor']) {
    const { unmount } = render(<ConteudoManual secao="veiculos" usuario={{ role }} />);
    fireEvent.click(screen.getByText('Manual de uso — Veículos'));
    expect(screen.getByText('Guia da empresa')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'Como preencher cada campo' })).toBeTruthy();
    expect(screen.getByText(/Ano inteiro entre 1886/)).toBeTruthy();
    unmount();
  }
});
it.each(['operador', 'motorista', undefined])('oferece somente uso ao perfil %s, sem instruções administrativas', (role) => {
  render(<ConteudoManual secao="veiculos" usuario={role ? { role } : null} />);
  expect(screen.getByText('Guia do usuário')).toBeTruthy();
  expect(screen.queryByText('Cadastro e gestão pela empresa')).toBeNull();
  expect(screen.queryByText('Como preencher cada campo')).toBeNull();
  expect(screen.queryByText(/Ano inteiro entre 1886/)).toBeNull();
});
it('reserva o manual de autorizar e revogar espelhamento à administração Linktrac', () => {
  const { rerender } = render(<ConteudoManual secao="espelhamentos" usuario={{ role: 'admin', podeGerenciarEspelhamentos: false }} />);
  expect(screen.queryByText('Cadastro e gestão pela empresa')).toBeNull();
  rerender(<ConteudoManual secao="espelhamentos" usuario={{ role: 'admin', podeGerenciarEspelhamentos: true }} />);
  expect(screen.getByText('Cadastro e gestão pela empresa')).toBeTruthy();
});
it('oculta imediatamente o conteúdo de gestão ao trocar para usuário comum', () => {
  const { rerender } = render(<ConteudoManual secao="usuarios" usuario={{ role: 'admin' }} />);
  expect(screen.getByText('Como preencher cada campo')).toBeTruthy();
  rerender(<ConteudoManual secao="usuarios" usuario={{ role: 'operador' }} />);
  expect(screen.queryByText('Como preencher cada campo')).toBeNull();
});
it('oferece manual para todas as rotas publicadas e para cada aba de histórico', () => {
  for (const secao of Object.values(secaoPorRota)) expect(manuais[secao]?.uso.length).toBeGreaterThan(0);
  for (const aba of ['alertas', 'ignicao', 'manutencoes', 'acoes']) expect(manuais[`historicos.${aba}`]?.uso.length).toBeGreaterThan(0);
});
it('documenta funções persistentes e seus limites', () => {
  for (const secao of ['painel', 'motoristas', 'relatorios', 'tms', 'configuracoes']) expect(manuais[secao].limites?.length).toBeGreaterThan(0);
  expect(manuais.motoristas.empresa.passos.join(' ')).toContain('permanecem salvos');
  expect(manuais.configuracoes.limites.join(' ')).toContain('gravadas no banco');
});
it('seleciona o manual pelo endereço sem exibir cadastros antes do login', () => {
  useAuth.mockReturnValue({ user: null, loading: false });
  const { unmount } = render(<MemoryRouter initialEntries={['/veiculos']}><ManualUso /></MemoryRouter>);
  expect(screen.queryByText('Manual de uso — Veículos')).toBeNull(); unmount();
  render(<MemoryRouter initialEntries={['/login']}><ManualUso /></MemoryRouter>);
  expect(screen.getByText('Manual de uso — Entrar')).toBeTruthy();
});
it('fecha o manual ao mudar de aba para não misturar orientações', () => {
  const { rerender } = render(<ConteudoManual secao="historicos.alertas" usuario={{ role: 'admin' }} />);
  const summary = screen.getByText('Manual de uso — Histórico de alertas');
  fireEvent.click(summary);
  const details = summary.closest('details'); details.open = true;
  rerender(<ConteudoManual secao="historicos.ignicao" usuario={{ role: 'admin' }} />);
  expect(screen.getByText('Manual de uso — Histórico de ignição').closest('details').open).toBe(false);
});
