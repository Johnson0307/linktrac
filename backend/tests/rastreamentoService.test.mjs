import { describe, it, expect } from 'vitest';
import { definirStatus, formatarCoordenadas } from '../src/services/rastreamentoService.js';

describe('rastreamentoService', () => {
  it('retorna Em movimento quando a velocidade é maior que 5', () => {
    expect(definirStatus(10)).toBe('Em movimento');
  });

  it('retorna Parado quando a velocidade é zero ou positiva e menor ou igual a 5', () => {
    expect(definirStatus(0)).toBe('Parado');
    expect(definirStatus(3)).toBe('Parado');
  });

  it('retorna Sem sinal para valores inválidos de velocidade', () => {
    expect(definirStatus(-1)).toBe('Sem sinal');
  });

  it('formata as coordenadas com 6 casas decimais', () => {
    expect(formatarCoordenadas(12.3456789, -98.7654321)).toBe('12.345679 , -98.765432');
  });
});
