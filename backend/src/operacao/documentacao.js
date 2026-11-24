const { intervalos, tiposCamera } = require('./telemetria');
const { tipos: tiposVideo } = require('./videoEventos');
const openapi = {
  openapi: '3.0.3', info: { title: 'Linktrac API', version: '1.0.0', description: 'Integração JSON normalizada. Protocolos TCP/UDP de fabricantes exigem gateway/adaptador; não estão implementados nesta API.' }, servers: [{ url: '/api' }],
  components: { securitySchemes: { sessao: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, deviceId: { type: 'apiKey', in: 'header', name: 'x-device-id' }, deviceToken: { type: 'apiKey', in: 'header', name: 'x-device-token' } }, schemas: {
    Posicao: { type: 'object', required: ['mensagemId', 'dataHora', 'latitude', 'longitude'], properties: { mensagemId: { type: 'string', maxLength: 100, description: 'Identificador estável; repetir a mensagem não duplica a posição.' }, dataHora: { type: 'string', format: 'date-time', description: 'Horário da medição, não do reenvio.' }, latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, velocidade: { type: 'number', minimum: 0, maximum: 300 }, ignicao: { type: 'boolean', nullable: true }, telemetria: { type: 'object', properties: { ...Object.fromEntries(Object.entries(intervalos).map(([k, [min, max]]) => [k, { type: 'number', minimum: min, maximum: max }])), portaAberta: { type: 'boolean' }, passageiroPresente: { type: 'boolean' }, identificadorMotorista: { type: 'string', maxLength: 80 }, dtcs: { type: 'array', maxItems: 30, items: { type: 'string', pattern: '^[PBCU][0-9A-F]{4}$' } }, eventosCamera: { type: 'array', maxItems: 10, items: { type: 'string', enum: tiposCamera } }, rede: { type: 'string', enum: ['celular', 'satelite', 'offline'] } } } } },
  } }, paths: {} };
const resposta = { '200': { description: 'Consulta ou mensagem já recebida.' }, '201': { description: 'Registro criado.' }, '400': { description: 'Dados inválidos.' }, '401': { description: 'Credenciais inválidas.' }, '403': { description: 'Perfil sem permissão.' }, '429': { description: 'Limite de requisições atingido.' }, '503': { description: 'Serviço indisponível.' } };
for (const path of ['/painel', '/veiculos', '/motoristas', '/operacao/catalogo', '/operacao/configuracoes', '/operacao/notificacoes', '/operacao/dispositivos', '/relatorios/campos', '/relatorios/comportamento', '/relatorios/combustivel']) openapi.paths[path] = { get: { security: [{ sessao: [] }], responses: resposta } };
openapi.paths['/integracao/posicoes'] = { post: { security: [{ deviceId: [], deviceToken: [] }], requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/Posicao' } } } }, responses: resposta } };
openapi.paths['/integracao/lote'] = { post: { security: [{ deviceId: [], deviceToken: [] }], requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', properties: { posicoes: { type: 'array', minItems: 1, maxItems: 100, items: { $ref: '#/components/schemas/Posicao' } } } } } } }, responses: resposta } };
openapi.paths['/operacao/{tipo}'] = { parameters: [{ name: 'tipo', in: 'path', required: true, schema: { type: 'string', enum: Object.keys(require('./catalogo').catalogo) } }], get: { security: [{ sessao: [] }], responses: resposta }, post: { security: [{ sessao: [] }], description: 'Campos e validações disponíveis em /operacao/catalogo.', responses: resposta } };
openapi.paths['/relatorios/consultar'] = { post: { security: [{ sessao: [] }], description: 'Selecione veiculoId, inicio, fim (ISO) e colunas (chaves de /relatorios/campos). Até 2.000 posições e 366 dias.', responses: resposta } };
const disponibilidade = [
  { recurso: 'Telemetria JSON, sensores e DTC', status: 'Software disponível; aguardando dados de equipamento compatível' },
  { recurso: 'RFID/iButton/identificador de câmera', status: 'Associação por identificador disponível; leitura física depende de integração' },
  { recurso: 'Videotelemetria', status: 'Recepção de eventos e links HTTPS de clipes via API. Protocolos proprietários e vídeo ao vivo dependem de integração.' },
  { recurso: 'Protocolos TCP/UDP e mais de 500 modelos', status: 'Receptor gerenciado e sincronização de cadastros disponíveis quando configurados no servidor. Consulte as portas ativas no cadastro e valide cada modelo com uma transmissão real.' },
  { recurso: 'Celular/satélite', status: 'Campo de rede disponível; troca de rede depende de hardware e serviço contratados' },
  { recurso: 'Posições offline', status: 'Reenvio por lote e deduplicação disponíveis; memória depende do aparelho' },
  { recurso: 'Bloqueio do veículo e travas', status: 'Sem transporte de comandos; nenhuma atuação física é executada' },
  { recurso: 'Avisos externos', status: 'E-mail e webhook opcionais para comunicação, saída de cerca e manutenção. Perda de alimentação do rastreador pode ser enviada ao contato autorizado do veículo pelo WhatsApp Business da empresa configurada.' },
  { recurso: 'Rotas por ruas, trânsito e ETA', status: 'Cálculo por ruas disponível com provedor configurado. Trânsito e ETA dependem da cobertura e dos dados recebidos.' },
  { recurso: 'SAP/TOTVS/Power BI', status: 'API JSON e CSV disponíveis; conectores específicos dependem do contrato de cada sistema' },
];
openapi.components.securitySchemes.gatewayId = { type: 'apiKey', in: 'header', name: 'x-gateway-id' };
openapi.components.securitySchemes.gatewayToken = { type: 'apiKey', in: 'header', name: 'x-gateway-token' };
openapi.paths['/integracao/telemetria'] = { post: { security: [{ deviceId: [], deviceToken: [] }], description: 'Leitura sem GPS. Envie mensagemId, dataHora e telemetria conforme o esquema Posicao. Não cria coordenadas.', responses: resposta } };
openapi.paths['/integracao/traccar'] = { post: { security: [{ gatewayId: [], gatewayToken: [] }], description: 'Recebe {position, device} do encaminhamento JSON Traccar. device.uniqueId deve corresponder a um equipamento ativo da mesma empresa. Configure forward.type=json e forward.header com os dois cabeçalhos. Fuel e power exigem normalização por protocolo.', responses: resposta } };
for (const path of ['/operacao/gateways', '/relatorios/financeiro', '/operacao/telemetria/{veiculoId}']) openapi.paths[path] = { get: { security: [{ sessao: [] }], responses: resposta } };
const telemetria = openapi.components.schemas.Posicao.properties.telemetria.properties;
telemetria.eventosDirecao = { type: 'array', maxItems: 10, items: { type: 'string', enum: ['frenagem', 'aceleracao', 'curva'] } };
telemetria.sensores = { type: 'array', maxItems: 16, items: { type: 'object', required: ['id', 'tipo', 'valor'], properties: { id: { type: 'string', maxLength: 40 }, tipo: { type: 'string', enum: ['temperatura', 'bateria', 'combustivel', 'porta', 'ocupacao'] }, valor: { oneOf: [{ type: 'number' }, { type: 'boolean' }] } } } };
openapi.paths['/assistente-manutencao/status'] = { get: { security: [{ sessao: [] }], description: 'Disponibilidade da análise técnica e interpretação opcional por IA. Somente gestores e administradores.', responses: resposta } };
openapi.paths['/assistente-manutencao/{veiculoId}/analisar'] = { parameters: [{name:'veiculoId',in:'path',required:true,schema:{type:'string'}}], post: {security:[{sessao:[]}],description:'Consulta até 2.000 leituras por fonte nos últimos sete dias e salva análise com evidências. Somente veículo próprio. Não chama IA externa.',responses:resposta} };
disponibilidade.push({recurso:'Assistente de manutenção',status:'Regras, recorrências e monitor opcional disponíveis. Interpretação por IA requer chave, modelo e ativação no servidor; sem modelo preditivo treinado.'});
openapi.paths['/integracao/video-eventos'] = { post: {
  security: [{ deviceId: [], deviceToken: [] }, { gatewayId: [], gatewayToken: [] }],
  description: 'O gateway informa device.uniqueId do equipamento ativo na mesma empresa. Reenvie o mesmo evento com a URL quando o clipe estiver disponível.',
  requestBody: { required: true, content: { 'application/json': { schema: {
    type: 'object', required: ['mensagemId', 'dataHora', 'tipo'], properties: {
      mensagemId: { type: 'string', maxLength: 100 }, dataHora: { type: 'string', format: 'date-time' },
      tipo: { type: 'string', enum: tiposVideo }, canal: { type: 'integer', minimum: 1, maximum: 64, default: 1 },
      device: { type: 'object', properties: { uniqueId: { type: 'string' } } },
      clipeUrl: { type: 'string', format: 'uri', description: 'URL HTTPS fornecida pelo integrador. A API não baixa o vídeo.' },
      clipeExpiraEm: { type: 'string', format: 'date-time' },
    },
  } } } }, responses: { ...resposta, '409': { description: 'Identificador pertence a outro evento.' } },
} };
openapi.paths['/operacao/video-eventos'] = { get: {
  security: [{ sessao: [] }],
  description: 'Eventos da empresa autenticada. Acesso de administrador e gestor. Use antes e eventoId para paginar e veiculoId para filtrar.',
  responses: resposta,
} };
telemetria.alimentacaoExterna = { type: 'boolean' };
telemetria.rodas = { type: 'array', maxItems: 32, items: { type: 'object', required: ['id'], properties: {
  id: { type: 'string', maxLength: 40 }, pressaoKpa: { type: 'number', minimum: 0, maximum: 2500 },
  temperaturaC: { type: 'number', minimum: -60, maximum: 250 },
} } };
openapi.paths['/relatorios/resumo-semanal'] = { get: { security: [{ sessao: [] }], responses: resposta } };
openapi.components.schemas.DeteccoesBle = { type: 'object', required: ['mensagemId','dataHora','tags'], properties: {
 mensagemId: { type: 'string', maxLength: 100 }, dataHora: { type: 'string', format: 'date-time' },
 latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 },
 tags: { type: 'array', minItems: 1, maxItems: 100, items: { type: 'object', required: ['formato','identificador'], properties: {
  formato: { type: 'string', enum: ['mac','ibeacon','eddystone'] }, identificador: { type: 'string', description: 'MAC de 12 hexadecimais; UUID:major:minor para iBeacon; Namespace+Instance de 32 hexadecimais para Eddystone UID.' },
  rssi: { type: 'number', minimum: -127, maximum: 20 }, bateriaV: { type: 'number', minimum: 0, maximum: 6 }, bateriaBaixa: { type: 'boolean' }, temperaturaC: { type: 'number', minimum: -100, maximum: 200 }
 } } }
} };
openapi.paths['/integracao/tags-ble'] = { post: { security: [{ deviceId: [], deviceToken: [] }], description: 'Detecções por receptor ativo autenticado. Atualiza somente tags cadastradas e ativas da mesma empresa, vinculadas ao receptor ou liberadas para qualquer receptor da empresa. Reenvios e leituras antigas não substituem a última detecção. Coordenadas opcionais são do receptor. Não calcula distância pelo RSSI.', requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/DeteccoesBle' } } } }, responses: resposta } };
openapi.paths['/operacao/tags-ble'] = { get: { security: [{ sessao: [] }], description: 'Cadastro e catálogo de referências BLE da empresa. Administrador ou gestor com acesso a equipamentos.', responses: resposta }, post: { security: [{ sessao: [] }], description: 'Cadastro com nome, bem, fabricante, modelo, formato, identificador, receptorId opcional, status, ativo, firmwareTag, firmwareReceptor e observacao. Status: a_testar, em_teste, homologada ou incompativel. A homologação deve ser validada pelo gestor após teste físico.', responses: resposta } };
disponibilidade.push({ recurso: 'Tags BLE e homologação', status: 'Cadastro, última detecção e auditoria disponíveis. Referências e adaptador Teltonika são sujeitos a teste de hardware e firmware. Outros receptores usam a API normalizada. Não equivale à certificação regulatória.' });
openapi.paths['/jornada'] = { get: { security: [{ sessao: [] }], description: 'Configuração pública da integração de ponto, fornecedores e vínculos da própria empresa. Não retorna token nem marcações. Administrador ou gestor com módulo de operação.', responses: resposta } };
openapi.paths['/jornada/configuracao'] = { put: { security: [{ sessao: [] }], description: 'Administrador: provedor (solides, pontomais, pontotel, oitchau, senior, outro), nomeOutro, liberada e token. Token vazio mantém o atual quando o fornecedor não muda. Troca remove a credencial anterior. Somente Sólides aceita token nesta etapa. Credencial protegida no servidor.', responses: resposta } };
openapi.paths['/jornada/testar'] = { post: { security: [{ sessao: [] }], description: 'Administrador: teste inicial da credencial Sólides salva. Não exige nem altera a declaração de liberação comercial. Limite por empresa: 1 a cada 30 segundos. Não valida plano nem sincronização de marcações.', responses: resposta } };
openapi.paths['/jornada/lembrete'] = { put: { security: [{ sessao: [] }], description: 'Administrador: ativo booleano. Lembrete web optativo, por empresa, após identificação enviada pelo equipamento autenticado e ignição ligada. Não registra ponto e não consulta marcações existentes.', responses: resposta } };
openapi.paths['/jornada/meus-lembretes'] = { get: { security: [{ sessao: [] }], description: 'Somente motorista ativo com e-mail da conta na mesma empresa e módulo de operação liberado. Aviso pessoal recente do ciclo de ignição atual. Não aceita motoristaId informado pelo cliente.', responses: resposta } };
openapi.paths['/jornada/meus-lembretes/{id}/dispensar'] = { post: { security: [{ sessao: [] }], description: 'Dispensa somente aviso próprio. Não registra nem confirma batida oficial de ponto.', responses: resposta } };
openapi.paths['/jornada/vinculos'] = { put: { security: [{ sessao: [] }], description: 'Associação preparatória de motoristaId da própria empresa ao colaboradorExterno do fornecedor selecionado.', responses: resposta } };
disponibilidade.push({ recurso: 'Jornada e integração com ponto', status: 'Preparação por empresa, fornecedores e vínculos disponíveis. Sólides: token protegido e teste de acesso inicial. Sincronização, ponto no app Linktrac e demais conectores pendentes de validação e desenvolvimento.' });
openapi.paths['/familia'] = { get: { security: [{ sessao: [] }], description: 'Somente dados da conta autenticada: responsável, menores próprios e posições ainda autorizadas. Não existe acesso geral à localização por perfil administrativo.', responses: resposta } };
openapi.paths['/familia/menores/{id}/historico'] = { parameters: [{ name:'id', in:'path', required:true, schema:{type:'string'} }], get: { security:[{sessao:[]}], description:'Histórico privado e auditado, até 500 posições recentes dentro de 14 dias, condicionado à autorização vigente.', responses:resposta } };
openapi.paths['/familia-dispositivo/parear'] = { post: { description:'Código de uso único, válido por 15 minutos, nomeAparelho; retorno de token opaco uma vez. Limite 20 tentativas/minuto por IP observado. Somente cadastro previamente verificado e autorizado.', responses:resposta } };
openapi.paths['/familia-dispositivo/posicoes'] = { post: { description:'Bearer opaco do aparelho. Até 200 pontos com mensagemId, latitude, longitude, precisao, dataHora ISO com fuso e velocidade opcional em km/h. Exige autorização vigente e compartilhamento iniciado. Deduplicação por aparelho/geração; retenção de 14 dias pela coleta.', responses:resposta } };
disponibilidade.push({recurso:'Pessoas e família — piloto web',status:'Cadastro, conferência manual independente, autorização, pareamento e GPS com página ativa. Dados privados por conta e separados dos veículos. Sem app nativo, segundo plano, KYC automatizado, SOS ou cercas pessoais. Validação jurídica/operacional para uso comercial ainda necessária.'});
module.exports = { openapi, disponibilidade };
