// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Espelhamentos from './Espelhamentos';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../api/api', () => ({ default: { get: vi.fn(), put: vi.fn(), delete: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});
const data = (espelhado = false) => ({
  data: {
    dados: {
      veiculos: [
        {
          _id: 'veiculo',
          placa: 'ABC1234',
          clienteId: { _id: 'origem', nome: 'Empresa A' },
          clientesEspelhados: espelhado ? [{ _id: 'destino', nome: 'Empresa B' }] : [],
        },
      ],
      empresas: [
        { _id: 'origem', nome: 'Empresa A' },
        { _id: 'destino', nome: 'Empresa B' },
      ],
    },
  },
});
describe('gestão de espelhamento', () => {
  it('não oferece gestão ao administrador de uma empresa cliente', () => {
    useAuth.mockReturnValue({ user: { role: 'admin', podeGerenciarEspelhamentos: false } });
    render(<Espelhamentos />);
    expect(screen.getByText('Acesso exclusivo à administração Linktrac.')).toBeDefined();
    expect(api.get).not.toHaveBeenCalled();
  });
  it('permite à Linktrac autorizar e revogar acesso sem criar outro veículo', async () => {
    useAuth.mockReturnValue({ user: { podeGerenciarEspelhamentos: true } });
    api.get
      .mockResolvedValueOnce(data())
      .mockResolvedValueOnce(data(true))
      .mockResolvedValueOnce(data());
    api.put.mockResolvedValue({ data: { mensagem: 'Espelhamento autorizado.' } });
    api.delete.mockResolvedValue({ data: { mensagem: 'Espelhamento revogado.' } });
    render(<Espelhamentos />);
    await screen.findByText('ABC1234 — Empresa A');
    fireEvent.change(screen.getByLabelText(/Veículo de origem/), { target: { value: 'veiculo' } });
    fireEvent.change(screen.getByLabelText(/Empresa que receberá acesso/), {
      target: { value: 'destino' },
    });
    fireEvent.click(screen.getByText('Autorizar espelhamento'));
    await screen.findByText('Espelhamento autorizado.');
    expect(api.put).toHaveBeenCalledWith('/espelhamentos/veiculo/clientes/destino');
    fireEvent.click(screen.getByText('Revogar acesso'));
    await screen.findByText('Espelhamento revogado.');
    expect(api.delete).toHaveBeenCalledWith('/espelhamentos/veiculo/clientes/destino');
    await waitFor(() => expect(screen.getByText('Nenhuma empresa autorizada.')).toBeDefined());
  });
});
