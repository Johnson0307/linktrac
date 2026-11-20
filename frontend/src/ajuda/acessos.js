export const permite = (user, modulo, alterar = false) => {
  if (user?.acessos == null) return true;
  const nivel = user.acessos[modulo];
  return nivel === 'configurar' || (!alterar && nivel === 'consulta');
};

export const areasCentrais = ['operacao', 'equipamentos', 'video', 'manutencao', 'entregas', 'relatorios'];

export const moduloDaArea = area => ({
  dispositivos: 'equipamentos', chips: 'equipamentos', 'historico-equipamentos': 'equipamentos', gateways: 'equipamentos',
  'video-eventos': 'video', planos: 'manutencao', cargas: 'entregas', sequencia: 'entregas',
  financeiro: 'relatorios', comportamento: 'relatorios', conferencia: 'relatorios',
})[area] || 'operacao';

export function permiteRota(user, pathname) {
  if (pathname === '/clientes' && user?.podeGerenciarCarteira) return true;
  if (pathname === '/operacao') return areasCentrais.some(modulo => permite(user, modulo));
  if (pathname === '/rastreadores' || pathname === '/cameras' || pathname === '/tags-ble') {
    return ['admin', 'gestor'].includes(user?.role) && permite(user, 'equipamentos');
  }
  if (pathname === '/monitoramento') return ['admin', 'gestor', 'operador'].includes(user?.role) && permite(user, 'operacao');
  if (pathname === '/jornada') return ['admin', 'gestor'].includes(user?.role) && permite(user, 'operacao');
  if (pathname === '/agro') return ['admin', 'gestor'].includes(user?.role) && permite(user, 'operacao');
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
