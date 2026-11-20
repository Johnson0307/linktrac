# Pessoas e família — piloto web

## Escopo entregue

Conta autenticada cadastra o responsável maior de idade e os menores próprios. Declaração e
aceite do termo não aprovam o cadastro. A administração Linktrac, em conta diferente do titular,
precisa conferir identidade, maioridade, contato e responsabilidade legal com evidência apropriada.
Os campos de conferência não constituem um serviço de KYC, reconhecimento facial ou verificação por SMS.

Após conferência e autorização vigente, o titular emite código temporário, uso único, 48 bits de
aleatoriedade, válido por 15 minutos. Código e token são guardados somente em hash SHA-256.
Novo código invalida o aparelho anterior. O token do aparelho expira em 90 dias.
A pessoa abre /pessoas/aparelho no celular, pareia e inicia explicitamente o compartilhamento,
concedendo a permissão do navegador. Há indicação visível e botão para interromper.

A versão WEB transmite com a página aberta e ativa. Ao ocultar a página, interrompe a coleta
local e tenta pausar no servidor. Não há garantia de segundo plano/tela bloqueada. O token fica
somente em sessionStorage da aba; não há coordenadas em armazenamento permanente no navegador.
Fila temporária em memória, no máximo 200 pontos, não equivale a armazenamento offline durável.
Nenhum link contém token ou código. O termo é aceite eletrônico autenticado, não assinatura ICP-Brasil.

## Aplicativo Linktrac Família (Android/iOS) — preparação do piloto

O diretório `mobile` contém o aplicativo de base compartilhada com localização nativa em segundo plano.
Não confundir os bundles JavaScript com um instalador assinado ou com validação em aparelho real.
A versão web segue funcionando como descrita acima. O backend só libera pareamento nativo quando
`FAMILIA_APP_HABILITADO=1` e quando o responsável registra o termo adicional específico de segundo
plano pela própria conta. O aceite web existente não autoriza essa ampliação automaticamente.

No celular do menor, instalar o app Linktrac Família, digitar o código de **Adicionar ou trocar aparelho**
e um nome livre, como **Celular do João**. O nome não é telefone, IMEI nem senha. O responsável
acompanha pela própria conta; o WhatsApp não realiza o rastreamento. Na alternativa web, o menor
abre https://linktracbrasiliaprime.com.br/pessoas/aparelho e mantém a página aberta e ativa.

Instruções de geração, instalação, armazenamento local protegido, limites de coleta, testes e
requisitos de distribuição: `mobile/README.md`. A liberação comercial e os testes físicos estão pendentes.

## Privacidade e acesso (comum às modalidades)

- Módulo familia separado dos módulos de veículos, controlado por empresa/revenda.
- Todo cadastro, consulta e histórico filtra clienteId + usuarioId da sessão; não aceita proprietário do corpo.
- Mesmo gestores/administradores não recebem localização de outras contas.
- Tela de conferência restrita à administração central, com dados cadastrais mínimos e sem coordenadas.
- Autorização exige conferências completas por outra conta, termo atual e menoridade ainda válida.
- Token sozinho não basta: status da conta/empresa, módulo e autorizações são conferidos novamente.
- Transações MongoDB serializam ingestão e revogação pelo mesmo documento. Replica set é necessário.
- Deduplicação por menor/geração/mensagemId. Reenvios não modificam coordenadas já gravadas.
- Última posição vem dos registros persistidos, não retrocede por lotes antigos e não é exibida quando pausada.
- Não há acesso público a mapas, convites a terceiros, SOS ou cercas pessoais nesta etapa.

## Retenção e revogação

Posições expiram 14 dias após a coleta por TTL. As leituras também filtram a expiração:
a limpeza física do MongoDB pode atrasar, mas o registro expirado não é devolvido pela API.
Aceitam-se lotes de no máximo 24 horas de atraso e somente depois da autorização, pareamento e início.
Revogar invalida token/código, interrompe novas posições e remove as posições do banco ativo,
em transação. Excluir menor também remove o cadastro. Auditoria específica mínima sem coordenadas
retém eventos por 180 dias; evita-se duplicar estes eventos na auditoria geral de retenção distinta.

Backups não são um arquivo de consultas de menores. Devem ter acesso restrito, prazo documentado
e testes de restauração. Antes de voltar a disponibilizar uma restauração, reaplicar exclusões e
revogações posteriores ao backup, invalidar pareamentos antigos e conferir expiração de posições.
Este piloto não implementa um orquestrador automático de restauração ou validação jurídica.

## Operação

- /pessoas: cadastro, termo, pareamento, mapa e histórico próprios.
- /pessoas/verificacoes: análise pela administração central; não aprova a própria identidade/vínculo.
- /pessoas/aparelho: pareamento e GPS explícito, sem login da conta do responsável no aparelho.
- /api/familia: JWT de usuário e módulo familia, inclusive nas alterações.
- /api/familia-dispositivo: autenticação própria por token e limite por aparelho; parear usa código.

Cada pessoa deve receber explicação adequada à idade e indicação clara de compartilhamento.
Antes de uso comercial com pessoas reais, validar termo, procedimento/evidências de conferência,
canal de atendimento e direitos dos titulares, responsabilidades entre Linktrac e empresas, política
de backup/descarte e aplicação da LGPD/ECA Digital. Não declarar homologação ou conformidade automática.

## Verificação

Testes unitários de idade, autorização, GPS e retenção; testes de interface do aceite e da ativação
explícita do GPS. Autoteste real com MongoDB replica set em ambiente descartável e sem pessoas reais:

FAMILIA_TESTE_DESCARTAVEL=1
MONGO_FAMILIA_TESTE_URI=mongodb://127.0.0.1:27017/linktrac_familia_teste_execucao?replicaSet=familiaTeste
node scripts/verificar-familia-isolado.js

O autoteste só aceita banco local cujo nome começa com linktrac_familia_teste_ e limpa apenas esse
banco. Nunca apontar para produção. Usa identidades e coordenadas sintéticas. Confere corrida de
pareamento, isolamento entre contas, revogação concorrente com ingestão, deduplicação e bloqueio TTL.

## Referências oficiais consultadas em 20/11/2026

- https://www.gov.br/anpd/pt-br/assuntos/eca-digital/
- https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-orientacoes-preliminares-e-cronograma-para-afericao-de-idade-no-ambiente-digital
- https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2018%3B13709
- https://developer.mozilla.org/en-US/docs/Web/API/Geolocation
