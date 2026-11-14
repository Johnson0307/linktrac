import api from './api';
export const obterConfiguracoes=async()=>{const r=await api.get('/operacao/configuracoes');return r.data.dados};
