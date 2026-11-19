const modulos = [
  { id: 'rastreamento', nome: 'Mapa, rastreamento e histórico de posições' },
  { id: 'veiculos', nome: 'Cadastro de veículos', edita: true },
  { id: 'motoristas', nome: 'Motoristas', edita: true },
  { id: 'manutencao', nome: 'Manutenção e análise técnica', edita: true },
  { id: 'relatorios', nome: 'Relatórios, resumo semanal e KML' },
  { id: 'entregas', nome: 'Entregas, rotas e contêineres', edita: true },
  { id: 'operacao', nome: 'Operação, cercas, pneus e abastecimentos', edita: true },
  { id: 'equipamentos', nome: 'Rastreadores, histórico e gateways', edita: true },
  { id: 'video', nome: 'Videotelemetria' },
  { id: 'configuracoes', nome: 'Configurações de alertas e telemetria', edita: true },
  { id: 'usuarios', nome: 'Usuários e auditoria', edita: true },
  { id: 'empresa', nome: 'Dados da própria empresa', edita: true },
  { id: 'marca', nome: 'Nome e logotipo do portal', edita: true },
];

const padrao = Object.fromEntries(modulos.map(m => [m.id, ['rastreamento', 'veiculos'].includes(m.id) ? 'consulta' : 'bloqueado']));
const legado = Object.fromEntries(modulos.map(m => [m.id, m.edita ? 'configurar' : 'consulta']));
const operacionais = ['operacao', 'equipamentos', 'video', 'manutencao', 'entregas', 'relatorios'];

function validarAcessos(valor) {
  if (!valor || typeof valor !== 'object' || Array.isArray(valor) || Object.keys(valor).some(id => !modulos.some(m => m.id === id))) return null;
  const acessos = {};
  for (const modulo of modulos) {
    const nivel = Object.hasOwn(valor, modulo.id) ? valor[modulo.id] : 'bloqueado';
    if (!['bloqueado', 'consulta', ...(modulo.edita ? ['configurar'] : [])].includes(nivel)) return null;
    acessos[modulo.id] = nivel;
  }
  return acessos;
}

function permite(acessos, modulo, alterar = false) {
  if (acessos == null) return true;
  const nivel = acessos[modulo];
  return nivel === 'configurar' || (!alterar && nivel === 'consulta');
}

function limitarAcessos(acessos, teto) {
  return Object.fromEntries(modulos.map(({ id }) => [
    id, !permite(acessos, id) || !permite(teto, id) ? 'bloqueado'
      : permite(acessos, id, true) && permite(teto, id, true) ? legado[id] : 'consulta',
  ]));
}

function regraApi(caminho, metodo) {
  const [, grupo, area, item] = caminho.split('/');
  const leitura = metodo === 'GET' || metodo === 'HEAD';
  if (grupo === 'auth' && area === 'me' || grupo === 'cliente' && area === 'marca' && item === 'atual' && leitura) return { livre: true };
  if (caminho === '/painel/rota' && metodo === 'POST') return { modulos: ['rastreamento'] };
  if (grupo === 'painel' || grupo === 'rastreamento') return { modulos: ['rastreamento'], alterar: !leitura };
  if (grupo === 'historicos') return { modulos: [area === 'acoes' ? 'usuarios' : item === 'manutencoes' ? 'manutencao' : 'rastreamento'], alterar: !leitura };
  if (grupo === 'assistente-manutencao') return { modulos: ['manutencao'], alterar: !leitura };
  if (grupo === 'veiculos' && area === 'opcoes' && leitura) return { modulos: ['veiculos', 'rastreamento', 'manutencao'] };
  if (grupo === 'relatorios') return { modulos: leitura || metodo === 'POST' && ['consultar', 'csv', 'trajeto'].includes(area) ? ['relatorios'] : [] };
  if (grupo === 'tms') return { modulos: ['entregas'], alterar: !leitura && !['rota', 'localizar'].includes(area) };
  if (grupo === 'operacao') {
    if (['opcoes', 'catalogo'].includes(area) && leitura) return { modulos: operacionais };
    const modulos = { configuracoes: 'configuracoes', dispositivos: 'equipamentos', chips: 'equipamentos', gateways: 'equipamentos', 'tags-ble': 'equipamentos',
      'video-eventos': 'video', planos: 'manutencao', cargas: 'entregas', sequenciar: 'entregas' };
    return { modulos: [Object.hasOwn(modulos, area) ? modulos[area] : 'operacao'], alterar: !leitura && area !== 'sequenciar' };
  }
  if (grupo === 'recursos') return { modulos: ['operacao', 'equipamentos', 'video'] };
  if (grupo === 'cliente') {
    if (['cadastros', 'acessos'].includes(area)) return { modulos: ['empresa'], alterar: !leitura };
    if (area === 'marca' && item === 'atual') return { modulos: ['marca'], alterar: true };
    if (['marca', 'briefings', 'acessos'].includes(area) || area === 'cadastros' && !leitura) return { modulos: [] };
    return { modulos: ['empresa'], alterar: !leitura };
  }
  if (['veiculos', 'motoristas', 'usuarios'].includes(grupo)) return { modulos: [grupo], alterar: !leitura };
  return { modulos: [] };
}

module.exports = { modulos, padrao, legado, operacionais, validarAcessos, permite, limitarAcessos, regraApi };
