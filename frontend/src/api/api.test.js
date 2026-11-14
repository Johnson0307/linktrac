import { afterEach, describe, it, expect, vi } from 'vitest';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetModules(); });
describe('cliente da API', () => {
  it('usa a URL configurada', async () => {
    vi.stubGlobal('__LINKTRAC_ENV__', {});
    vi.stubEnv('VITE_API_URL', 'https://api.example.com/api');
    const { default: api } = await import('./api');
    expect(api.defaults.baseURL).toBe('https://api.example.com/api');
  });
  it.each(['/auth/login', '/auth/register', '/veiculos'])('trata 401 em %s', async (url) => {
    const removeItem = vi.fn();
    const location = { pathname: '/veiculos', href: '/veiculos' };
    vi.stubGlobal('localStorage', { removeItem });
    vi.stubGlobal('window', { location });
    const { default: api } = await import('./api');
    const erro = { response: { status: 401 }, config: { url } };
    await expect(api.interceptors.response.handlers[0].rejected(erro)).rejects.toBe(erro);
    if (url === '/veiculos') {
      expect(removeItem).toHaveBeenCalledWith('token');
      expect(location.href).toBe('/login');
    } else {
      expect(removeItem).not.toHaveBeenCalled();
      expect(location.href).toBe('/veiculos');
    }
  });
});
