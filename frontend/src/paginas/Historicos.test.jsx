// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Historicos from './Historicos';
import api from '../api/api';
import { useAuth } from '../contexts/AuthContext';
vi.mock('../api/api', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
const veiculo = { _id: 'id', clienteId: 'empresa', placa: 'TESTE01', marca: 'TESTE', modelo: 'SIMULACAO' };
const abrir = (inicial) => {
  useAuth.mockReturnValue({ user: { role: 'admin', clienteId: 'empresa' } });
  return render(<MemoryRouter><Historicos inicial={inicial} /></MemoryRouter>);
};
afterEach(() => { cleanup(); vi.resetAllMocks(); });
it('separa alertas e ignição e identifica os dados simulados', async () => {
  api.get.mockImplementation(async (url) => ({ data: url === '/veiculos' ? { dados: [veiculo] } : { alertas: [{ tipo: 'Velocidade acima de 80 km/h', dataHora: '2026-10-26T12:00:00Z', detalhe: '90 km/h', simulado: true }], ignicao: [{ ligada: false, tipo: 'Estado observado', dataHora: '2026-10-26T12:00:00Z', simulado: true }] } }));
  abrir();
  expect(await screen.findByText('90 km/h')).toBeTruthy();
  expect(screen.getByText('Simulado')).toBeTruthy();
  fireEvent.change(screen.getByRole('combobox', { name: 'Tipo de histórico' }), { target: { value: 'ignicao' } });
  expect(await screen.findByText('Desligada')).toBeTruthy();
  expect(screen.getByText(/Não inferimos ignição/)).toBeTruthy();
});
it('registra manutenção com custo em centavos e exibe o resultado', async () => {
  api.get.mockResolvedValueOnce({ data: { dados: [veiculo] } }).mockResolvedValue({ data: { dados: [] } });
  api.post.mockResolvedValue({ data: { dados: { _id: 'm', servico: 'Troca de óleo', custoCentavos: 12550, dataServico: '2026-10-26', quilometragem: 1000 } }, headers: {} });
  abrir('manutencoes');
  await screen.findByText('Registrar serviço realizado');
  for (const [campo, valor] of [['Serviço', 'Troca de óleo'], ['Data do serviço', '2026-10-26'], ['Custo (R$)', '125.50'], ['Quilometragem (km)', '1000']])
    fireEvent.change(screen.getByLabelText(campo, { exact: true }), { target: { value: valor } });
  fireEvent.click(screen.getByRole('button', { name: 'Registrar manutenção' }));
  await waitFor(() => expect(api.post).toHaveBeenCalledWith('/historicos/id/manutencoes', expect.objectContaining({ custoCentavos: 12550, quilometragem: 1000 })));
  expect(await screen.findByText('Manutenção registrada com sucesso.')).toBeTruthy();
});
it('não oferece auditoria nem cadastro de manutenção ao operador', async () => {
  useAuth.mockReturnValue({ user: { role: 'operador', clienteId: 'empresa' } });
  api.get.mockResolvedValue({ data: { dados: [veiculo] } });
  render(<MemoryRouter><Historicos inicial="manutencoes" /></MemoryRouter>);
  await screen.findByRole('option', { name: /TESTE01/ });
  expect(screen.queryByRole('option', { name: 'Ações dos usuários' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Registrar manutenção' })).toBeNull();
});
