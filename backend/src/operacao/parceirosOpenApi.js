const parametro = (nome, em, schema, obrigatorio = false) =>
  ({ name: nome, in: em, required: obrigatorio, schema });
const id = { type: 'string', pattern: '^[a-fA-F0-9]{24}$' };
const data = { type: 'string', format: 'date-time' };
const veiculoId = parametro('id', 'path', id, true);
const limite = maximo => parametro('limite', 'query', { type: 'integer', minimum: 1, maximum: maximo, default: 100 });
const nullable = schema => ({ anyOf: [schema, { type: 'null' }] });
const referencia = nome => ({ $ref: `#/components/schemas/${nome}` });
const lista = schema => ({ type: 'array', items: schema });
const resposta = (descricao, dados, proximo) => ({ description: descricao, content: {
  'application/json': { schema: { type: 'object', properties: {
    sucesso: { type: 'boolean' }, dados, ...(proximo ? { proximo: nullable(proximo) } : {}),
  } } },
} });
const erros = {
  400: { description: 'Parâmetros inválidos' }, 401: { description: 'Chave inválida ou revogada' },
  403: { description: 'Operação não liberada' }, 404: { description: 'Veículo não encontrado' },
  503: { description: 'Integração temporariamente indisponível' },
};
const camposEditaveis = {
  marca: { type: 'string', minLength: 1, maxLength: 100 },
  modelo: { type: 'string', minLength: 1, maxLength: 100 },
  ano: { type: 'integer', minimum: 1886 },
  cor: { type: 'string', maxLength: 100 },
};

module.exports = {
  openapi: '3.1.0',
  info: { title: 'Linktrac API de parceiros', version: '1.0.0',
    description: 'Integração de servidor a servidor. Envie a chave no cabeçalho Authorization: Bearer SUA_CHAVE. Cada chave acessa somente os veículos próprios da empresa e as operações liberadas pela Linktrac. Use HTTPS em produção.' },
  servers: [{ url: '/api/parceiros/v1' }],
  security: [{ chave: [] }],
  components: {
    securitySchemes: { chave: { type: 'http', scheme: 'bearer', description: 'Chave emitida na tela de Integrações do cliente.' } },
    schemas: {
      Veiculo: { type: 'object', properties: { _id: id, placa: { type: 'string' }, ...camposEditaveis, ativo: { type: 'boolean' } } },
      Posicao: { type: 'object', properties: { _id: id, latitude: { type: 'number' }, longitude: { type: 'number' },
        dataHora: data, velocidade: { type: 'number', description: 'km/h' }, status: { type: 'string' }, ignicao: nullable({ type: 'boolean' }) } },
    },
  },
  paths: {
    '/veiculos': { get: { summary: 'Listar veículos próprios', description: 'Requer veiculos:ler. Envie proximo como apos para buscar a próxima página.',
      parameters: [limite(100), parametro('apos', 'query', id)], responses: {
        200: resposta('Lista paginada', lista(referencia('Veiculo')), id), ...erros,
      } } },
    '/veiculos/{id}/posicao': { get: { summary: 'Consultar a última posição', description: 'Requer posicoes:ler. Dados nulos indicam veículo sem posição.',
      parameters: [veiculoId], responses: { 200: resposta('Última posição', nullable(referencia('Posicao'))), ...erros } } },
    '/veiculos/{id}/posicoes': { get: { summary: 'Consultar histórico GPS', description: 'Requer posicoes:ler. Envie antes e antesId retornados em proximo, mantendo início e fim.',
      parameters: [veiculoId, parametro('inicio', 'query', data, true), parametro('fim', 'query', data, true),
        limite(500), parametro('antes', 'query', data), parametro('antesId', 'query', id)],
      responses: { 200: resposta('Posições da mais recente para a mais antiga', lista(referencia('Posicao')),
        { type: 'object', properties: { antes: data, antesId: id } }), ...erros } } },
    '/veiculos/{id}': { patch: { summary: 'Atualizar descrição do veículo', description: 'Requer veiculos:editar.',
      parameters: [veiculoId], requestBody: { required: true, content: { 'application/json': { schema: {
        type: 'object', minProperties: 1, additionalProperties: false, properties: camposEditaveis,
      } } } }, responses: { 200: resposta('Veículo atualizado', referencia('Veiculo')), ...erros } } },
  },
};
