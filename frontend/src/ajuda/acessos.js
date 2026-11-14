export const permite = (user, modulo, alterar = false) => {
  if (user?.acessos == null) return true;
  const nivel = user.acessos[modulo];
  return nivel === 'configurar' || (!alterar && nivel === 'consulta');
};

export const areasCentrais = ['operacao', 'equipamentos', 'video', 'manutencao', 'entregas', 'relatorios'];

export const moduloDaArea = area => ({
  dispositivos: 'equipamentos', 'historico-equipamentos': 'equipamentos', gateways: 'equipamentos',
  'video-eventos': 'video', planos: 'manutencao', cargas: 'entregas', sequencia: 'entregas',
  financeiro: 'relatorios', comportamento: 'relatorios', conferencia: 'relatorios',
})[area] || 'operacao';

export function permiteRota(user, pathname) {
  if (pathname === '/clientes' && user?.podeGerenciarCarteira) return true;
  if (pathname === '/operacao') return areasCentrais.some(modulo => permite(user, modulo));
  if (pathname === '/historicos') return ['rastreamento', 'manutencao', 'usuarios'].some(modulo => permite(user, modulo));
  if (pathname === '/marca') return permite(user, 'marca', true);
  const modulo = {
    '/mapa': 'rastreamento', '/rastreamento': 'rastreamento', '/veiculos': 'veiculos', '/motoristas': 'motoristas',
    '/relatorios': 'relatorios', '/resumo-semanal': 'relatorios', '/tms': 'entregas', '/tms/cargas': 'entregas', '/minhas-rotas': 'entregas',
    '/manutencao': 'manutencao', '/manutencao-inteligente': 'manutencao', '/configuracoes': 'configuracoes',
    '/usuarios': 'usuarios', '/clientes': 'empresa',
  }[pathname];
  return !modulo || permite(user, modulo);
}
