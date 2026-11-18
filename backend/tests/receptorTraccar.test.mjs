import { expect, it, vi } from 'vitest';
import receptor from '../src/operacao/receptorTraccar.js';

const cadastro = { _id: 'cadastro-atual', codigoExterno: '123456789012345' };
const dispositivo = { id: 9, name: 'Linktrac • 2345', uniqueId: cadastro.codigoExterno,
  disabled: false, attributes: { linktracCadastro: cadastro._id } };

it('registra novos IMEIs com o vínculo e não altera dispositivos já sincronizados', async () => {
  const requisitar = vi.fn().mockResolvedValueOnce([]).mockResolvedValue({});
  await receptor.aplicarCadastros({ listar: async () => [cadastro], requisitar });
  expect(requisitar).toHaveBeenLastCalledWith('devices', 'POST', expect.objectContaining({
    uniqueId: cadastro.codigoExterno, attributes: { linktracCadastro: cadastro._id },
  }));
  requisitar.mockReset().mockResolvedValueOnce([dispositivo]);
  await receptor.aplicarCadastros({ listar: async () => [cadastro], requisitar });
  expect(requisitar).toHaveBeenCalledTimes(1);
});

it('desativa no receptor os IMEIs retirados ou desativados na Linktrac', async () => {
  const requisitar = vi.fn().mockResolvedValueOnce([dispositivo]).mockResolvedValue({});
  await receptor.aplicarCadastros({ listar: async () => [], requisitar });
  expect(requisitar).toHaveBeenLastCalledWith('devices/9', 'PUT', { ...dispositivo, disabled: true });
});

it('atualiza o vínculo quando um IMEI excluído é cadastrado de novo', async () => {
  const requisitar = vi.fn().mockResolvedValueOnce([{ ...dispositivo, disabled: true,
    attributes: { linktracCadastro: 'cadastro-antigo' } }]).mockResolvedValue({});
  await receptor.aplicarCadastros({ listar: async () => [cadastro], requisitar });
  expect(requisitar).toHaveBeenLastCalledWith('devices/9', 'PUT', dispositivo);
});

it('preserva dispositivos externos e continua sincronizando os demais cadastros', async () => {
  const requisitar = vi.fn().mockResolvedValueOnce([{ ...dispositivo, attributes: {} }]).mockResolvedValue({});
  const outro = { _id: 'outro', codigoExterno: '987654321012345' };
  await expect(receptor.aplicarCadastros({ listar: async () => [cadastro, outro], requisitar }))
    .rejects.toThrow('associado');
  expect(requisitar).toHaveBeenLastCalledWith('devices', 'POST', expect.objectContaining({ uniqueId: outro.codigoExterno }));
  expect(requisitar).toHaveBeenCalledTimes(2);
});
