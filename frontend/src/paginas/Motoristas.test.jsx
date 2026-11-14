// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Motoristas from './Motoristas';
import { listarMotoristas, salvarMotorista } from '../api/motoristas';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../api/motoristas', () => ({ listarMotoristas: vi.fn(), salvarMotorista: vi.fn() }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const vazio = { dados: [], total: 0, pagina: 1, paginas: 1 };
const motorista = { _id: 'id', nome: 'Motorista de teste', cpf: '12345678909', cnh: '12345678901', validadeCnh: '2028-10-01', categoriaCnh: 'AB', status: 'ativo' };
afterEach(() => { cleanup(); vi.resetAllMocks(); });
const abrir = (role = 'admin') => { useAuth.mockReturnValue({ user: { role, clienteId: 'empresa' } }); return render(<Motoristas />); };
it('grava o motorista pela API e confirma o cadastro', async () => {
  listarMotoristas.mockResolvedValue(vazio); salvarMotorista.mockResolvedValue({ sucesso: true, dados: motorista }); abrir();
  await screen.findByText(/Nenhum motorista encontrado/);
  for (const [label, value] of [['Nome completo', motorista.nome], ['CPF', motorista.cpf], ['Número da CNH', motorista.cnh], ['Validade da CNH', motorista.validadeCnh], ['Categoria da CNH', 'AB']])
    fireEvent.change(screen.getByLabelText(label, { exact: true }), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: 'Cadastrar motorista', exact: true }));
  expect(await screen.findByText('Motorista cadastrado com sucesso.')).toBeTruthy();
  expect(salvarMotorista).toHaveBeenCalledWith(expect.objectContaining({ nome: motorista.nome, cpf: motorista.cpf, categoriaCnh: 'AB' }), null);
  await waitFor(() => expect(listarMotoristas).toHaveBeenCalledTimes(2));
});
it('permite editar e inativar um motorista sem excluí-lo', async () => {
  listarMotoristas.mockResolvedValue({ ...vazio, dados: [motorista], total: 1 }); salvarMotorista.mockResolvedValue({ sucesso: true }); abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Motorista de teste' }));
  expect(screen.getByLabelText('CPF').value).toBe(motorista.cpf);
  fireEvent.change(screen.getByLabelText('Situação do motorista'), { target: { value: 'inativo' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(await screen.findByText('Motorista atualizado com sucesso.')).toBeTruthy();
  expect(salvarMotorista).toHaveBeenCalledWith(expect.objectContaining({ status: 'inativo' }), 'id');
});
it('oferece apenas consulta básica ao operador', async () => {
  listarMotoristas.mockResolvedValue({ ...vazio, dados: [{ nome: motorista.nome, _id: 'id', validadeCnh: motorista.validadeCnh, categoriaCnh: 'AB', status: 'ativo' }], total: 1 }); abrir('operador');
  await screen.findByText(motorista.nome);
  expect(screen.queryByLabelText('CPF')).toBeNull();
  expect(screen.queryByRole('button', { name: /Editar/ })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Cadastrar motorista' })).toBeNull();
});
it('mantém a mensagem de erro de conexão distinta da lista vazia', async () => {
  listarMotoristas.mockRejectedValue({ response: { data: { mensagem: 'Banco indisponível.' } } }); abrir();
  expect((await screen.findByRole('alert')).textContent).toBe('Banco indisponível.');
  expect(screen.queryByText(/Nenhum motorista encontrado/)).toBeNull();
});
it('mostra conflito de documento sem limpar o formulário', async () => {
  listarMotoristas.mockResolvedValue({ ...vazio, dados: [motorista], total: 1 });
  salvarMotorista.mockRejectedValue({ response: { data: { mensagem: 'CPF ou CNH já cadastrado nesta empresa.' } } }); abrir();
  fireEvent.click(await screen.findByRole('button', { name: 'Editar Motorista de teste' }));
  fireEvent.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect((await screen.findByRole('alert')).textContent).toContain('já cadastrado');
  expect(screen.getByLabelText('Nome completo').value).toBe(motorista.nome);
});
