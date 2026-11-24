# Lembrete de ponto por identificação do motorista

O administrador pode ativar a opção em **Gestão → Jornada de trabalho → Lembrete de ponto ao identificar o motorista**. Começa desativada em cada empresa.

1. Cadastre um motorista ativo com o identificador usado no leitor do equipamento.
2. A conta de acesso deve ter perfil Motorista, pertencer à mesma empresa e usar o mesmo e-mail do cadastro. Mais de um cadastro ativo com esse e-mail bloqueia o acesso ao aviso.
3. Libere o módulo Operação para a empresa. O motorista deve entrar na plataforma web no próprio celular e manter a página aberta.
4. O equipamento autenticado precisa enviar ignição ligada e `telemetria.identificadorMotorista`. O receptor Traccar normaliza `driverUniqueId`. A compatibilidade física depende do leitor, protocolo e firmware; vincular um motorista administrativamente ao veículo não substitui identificação.
5. O motorista recebe um aviso na página em até 30 segundos da recepção. Ele abre o sistema de ponto e faz o registro com o veículo parado. Para Sólides selecionada na empresa, há um link para o acesso do fornecedor.
6. Se já registrou a entrada, pode dispensar o lembrete. **Dispensar não registra nem confirma ponto.**

A versão atual não consulta se a jornada já está aberta no fornecedor, não recolhe foto, não calcula horas e não envia batidas oficiais. O funcionário pode registrar o ponto antes de ligar o veículo, diretamente no fornecedor.

## Detecção e privacidade

- Somente leituras reais autenticadas, com ignição booleana, de até 5 minutos atrás e no máximo 30 segundos no futuro.
- Ignição desligada encerra o ciclo. Identificação posterior à ignição é aceita; leituras repetidas do mesmo motorista no ciclo não criam novos avisos. Troca de motorista exige identificador enviado pelo equipamento.
- Estado e aviso são gravados na mesma transação MongoDB. Requer replica set, como os demais fluxos transacionais da plataforma.
- Avisos pessoais deixam de aparecer ao desligar, mudar o motorista, dispensar ou completar uma hora do evento. Exibição exige uma leitura do ciclo nos últimos 5 minutos. Falta de comunicação pode atrasar a percepção de desligamento.
- O identificador do leitor não é retornado na resposta pessoal. Não há consulta de outros motoristas por ID informado pelo cliente.
- A central pode consultar a notificação operacional dentro de sua empresa. Ela não substitui um espelho de ponto.

## Aplicativo e integração

Este é um **lembrete na página web aberta**. Não é push com tela bloqueada. O app Linktrac Família ainda não possui autenticação do motorista nem notificações deste módulo. A próxima etapa exige esse fluxo de acesso, permissão de notificação no celular, configuração de envio para Android/iOS e testes físicos.

O teste inicial da credencial Sólides é independente da declaração de liberação comercial: usa exclusivamente `GET https://employer.tangerino.com.br/test`, com limite de um teste por empresa a cada 30 segundos. Não ativa sincronização nem confirma plano, preço ou disponibilidade da API de marcações. O token continua protegido no servidor.

## Verificação

Testes de regras e telas ficam em `backend/tests/lembretePonto.test.mjs`, `backend/tests/solidesPonto.test.mjs`, `frontend/src/componentes/LembretePonto.test.jsx` e `frontend/src/paginas/Jornada.test.jsx`.

O script `backend/scripts/verificar-jornada-isolada.js` cria seu próprio MongoDB local temporário em replica set e usa apenas empresas e motoristas sintéticos. Não lê `.env`, não se conecta a bancos externos e não chama a Sólides. Valida deduplicação, desligamento, novo ciclo, isolamento de contas e revogação do módulo; encerra o banco ao concluir.
