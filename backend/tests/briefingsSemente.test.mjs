import { afterEach, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url), express = require('express');
const fila = require('../src/services/briefingFila');
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });
it('importação das edições disponíveis preserva datas já revisadas e exige administração central', async () => {
  const empresa = '507f1f77bcf86cd799439011'; vi.stubEnv('LINKTRAC_CLIENT_ID', empresa);
  const datas = vi.spyOn(fila.Edicao, 'distinct').mockResolvedValue(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09']);
  const registrar = vi.spyOn(fila, 'registrarEdicoes').mockResolvedValueOnce(3).mockResolvedValueOnce(0);
  const app = express(); app.use(express.json()); app.use((req, _res, next) => {
    req.user = { clienteId: empresa, role: req.get('x-test-role') || 'admin', email: 'teste@example.invalid' }; next();
  }); app.use(require('../src/routes/briefingRoutes'));
  const servidor = app.listen(0, '127.0.0.1'); await new Promise(r => servidor.once('listening', r));
  const pedir = async role => fetch(`http://127.0.0.1:${servidor.address().port}/edicoes-disponiveis`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(role ? { 'x-test-role': role } : {}) }, body: '{}' });
  try {
    const res = await pedir(); expect(res.status).toBe(201); expect((await res.json()).novas).toBe(3);
    expect(registrar.mock.calls[0][1].map(e => e.data)).toEqual(['2026-09-28', '2026-11-16', '2026-11-23']);
    datas.mockResolvedValue(require('../src/data/briefings-propostas-ate-2026-11-23.json').map(e => e.data));
    expect((await pedir()).status).toBe(200); expect(registrar.mock.calls[1][1]).toEqual([]);
    expect((await pedir('gestor')).status).toBe(403); expect(registrar).toHaveBeenCalledTimes(2);
  } finally { await new Promise(r => servidor.close(r)); }
});
