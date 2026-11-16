// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import Register from './Register';
import { consultarCadastroInicial } from '../api/auth';

vi.mock('../api/auth', () => ({ consultarCadastroInicial: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ user: null, loading: false, register: vi.fn() }),
}));

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

function abrirCadastro() {
  render(<MemoryRouter><Register /></MemoryRouter>);
}

it('leva ao login e orienta o cadastro no painel quando a plataforma já está configurada', async () => {
  consultarCadastroInicial.mockResolvedValue('encerrado');
  abrirCadastro();

  expect(await screen.findByText(/a plataforma já está configurada/i)).toBeTruthy();
  expect(screen.getByText('Clientes → Novo cliente')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Ir para o login' }).getAttribute('href')).toBe('/login');
  expect(screen.queryByLabelText('Nome da empresa')).toBeNull();
});

it.each([['inicial', false], ['codigo', true]])('mostra o formulário no modo %s', async (modo, temCodigo) => {
  consultarCadastroInicial.mockResolvedValue(modo);
  abrirCadastro();

  expect(await screen.findByLabelText('Nome da empresa')).toBeTruthy();
  const campoCodigo = screen.queryByLabelText('Código de registro');
  expect(Boolean(campoCodigo)).toBe(temCodigo);
  if (campoCodigo) expect(campoCodigo.required).toBe(true);
});

it('permite tentar a consulta novamente após uma indisponibilidade', async () => {
  consultarCadastroInicial.mockRejectedValueOnce(new Error('Indisponível')).mockResolvedValueOnce('inicial');
  abrirCadastro();

  expect(await screen.findByRole('alert')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByLabelText('Nome da empresa')).toBeTruthy();
});
