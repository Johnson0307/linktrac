// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import CatalogoRastreadores from './CatalogoRastreadores';

afterEach(cleanup);

function escolherModelo(busca, nome) {
  fireEvent.change(screen.getByRole('searchbox', { name: 'Marca ou modelo' }), { target: { value: busca } });
  const resultado = screen.getByRole('option', { name: nome });
  fireEvent.change(screen.getByLabelText('Resultados do catálogo'), { target: { value: resultado.value } });
}

it('consulta a configuração do resultado antes de preencher o cadastro', () => {
  const selecionar = vi.fn();
  render(<CatalogoRastreadores selecionar={selecionar} />);
  fireEvent.click(screen.getByText('Buscar marca ou modelo no catálogo'));
  escolherModelo('lv12', /LV12 4G USB Mini/);
  expect(screen.getByText('APN,<APN>,<USUÁRIO>,<SENHA>#')).toBeTruthy();
  expect(selecionar).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Usar este modelo' }));
  expect(selecionar).toHaveBeenCalledWith(expect.objectContaining({ modelo: 'LV12 4G USB Mini' }));
});

it('mostra as referências da linha LV12 sem atribuir os comandos do USB Mini ao aparelho 4G SA', () => {
  render(<CatalogoRastreadores fabricante="Império dos Rastreadores" modelo="LV-12 4G SA" />);
  expect(screen.getByRole('link', { name: /manual Termo Retrátil/ })).toBeTruthy();
  expect(screen.queryByText('APN,<APN>,<USUÁRIO>,<SENHA>#')).toBeNull();
});

it('consulta câmeras na videotelemetria e informa quando falta guia verificado', () => {
  render(<CatalogoRastreadores somenteCameras />);
  fireEvent.click(screen.getByText('Catálogo e configurações de câmeras'));
  escolherModelo('jc450', /JC450 —/);
  expect(screen.getByRole('link', { name: /Jimi IoT — configuração e teste/ })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Usar este modelo' })).toBeNull();
  escolherModelo('jc450pro', /JC450Pro/);
  expect(screen.getByText(/sem guia de configuração verificado/)).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Jimi IoT — configuração e teste/ })).toBeNull();
});
