import api from './api';
export const listarMotoristas = async ({ busca = '', situacao = '', pagina = 1 } = {}) => {
  const params = new URLSearchParams({ busca, situacao, pagina: String(pagina) });
  const response = await api.get(`/motoristas?${params}`);
  return response.data;
};
export const salvarMotorista = async (dados, id) => {
  const response = id ? await api.put(`/motoristas/${encodeURIComponent(id)}`, dados) : await api.post('/motoristas', dados);
  return { ...response.data, auditoriaIndisponivel: Boolean(response.headers?.['x-linktrac-auditoria']) };
};
