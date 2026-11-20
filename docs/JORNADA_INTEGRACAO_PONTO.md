# Jornada e integração com fornecedor de ponto — etapa preparatória

Esta etapa NÃO coleta ponto, não sincroniza marcações, não calcula horas e não substitui REP-P/PTRP.
O trabalhador continua registrando o ponto no aplicativo do fornecedor. A liberação comercial,
retenção dos registros e coleta externa precisam ser confirmadas com cada fornecedor.

## Disponível

- Menu Gestão > Jornada de trabalho.
- Preferência de fornecedor por empresa: Sólides, VR/Pontomais, Pontotel, Oitchau, Senior ou Outro.
- Credenciais somente para Sólides nesta etapa: armazenamento AES-256-GCM, contexto por empresa,
  sem exibição ou registro de token em logs; rotação, remoção e liberação informada pelo administrador.
- Proteção por INTEGRACOES_CHAVE_CRIPTOGRAFIA (64 hex). Se ausente, usa a chave privada existente
  FINANCEIRO_CHAVE_CRIPTOGRAFIA, com contexto separado. Nunca há chave fixa ou fallback inseguro.
  Sem chave válida, o token não é aceito e o formulário informa a pendência.
- Teste GET de acesso inicial documentado pela Sólides, apenas após liberação informada e com token.
  Destino fixo HTTPS, sem redirecionamentos, timeout de 8 segundos e intervalo de 30 segundos por empresa.
  O resultado NÃO comprova acesso aos pontos nem gratuidade. Endereço indisponível é informado.
- Associação preparatória de motorista próprio ao ID/identificador externo do colaborador.
- Configuração e consulta limitadas à empresa autenticada, com módulo Operação.
  Administrador altera credenciais; gestor com configuração pode preparar vínculos.
- Vínculos separados por fornecedor e preservados na troca; troca remove a credencial anterior.
- Auditoria existente da plataforma registra as alterações sem o corpo das requisições.

## API Linktrac

- GET /api/jornada — configuração pública, fornecedores, motoristas e vínculos próprios.
- PUT /api/jornada/configuracao — administrador; provedor, nomeOutro, liberada e token.
- POST /api/jornada/testar — administrador; teste inicial Sólides, sem importar registros.
- POST /api/jornada/desconectar — administrador; remove token e desativa liberação.
- PUT /api/jornada/vinculos — motoristaId e colaboradorExterno para fornecedor salvo.

Não existe envio de marcações para terceiros nesta etapa, nem consultas periódicas automáticas.
Os nomes dos fornecedores na seleção não significam que seus conectores estejam implementados.

## Próximas etapas após resposta do fornecedor

1. Confirmar plano, custo/API gratuita, uso multiempresa/revenda e autorização de cada cliente.
2. Obter credencial e documentação/OpenAPI atual do ambiente autorizado, incluindo URL HTTPS,
   paginação, campos, fuso, limites e significado dos horários/ajustes.
3. Testar consultas de colaboradores e marcações com empresa/pessoas de teste autorizadas.
4. Desenvolver sincronização incremental idempotente, validação por empresa, situação de sincronização
   e recuperação de falhas, preservando a origem e o identificador do fornecedor.
5. Implementar consulta/obtenção da folha oficial conforme permissões e política de retenção.
6. Coleta no aplicativo Linktrac é um projeto separado: confirmar coletor externo de marcações originais,
   comprovantes e responsabilidades. Não usar lançamento de atraso/ajuste como substituto.

## Referências e limitações verificadas

Documentação pública Sólides: https://docs.tangerino.com.br/
O manual orienta solicitar token ao suporte, autenticação Basic com o token fornecido,
consulta de pontos por período/lastUpdate e /time-sheet. O exemplo de teste é /test no host employer.
O manual contém exemplos HTTP antigos: a Linktrac só usa HTTPS.
Em 20/11/2026, a consulta pública a https://api.tangerino.com.br/v2/api-docs e à raiz do host retornou 404.
Por isso não foi presumido o contrato de resposta nem habilitada a sincronização.

Verificação: suíte local de backend e frontend e build. Integração externa ainda não validada.
