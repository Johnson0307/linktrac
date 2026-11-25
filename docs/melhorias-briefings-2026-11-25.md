# Atualização a partir dos briefings semanais de rastreamento

Referência: chat **Briefing semanal de frotas**, edições de 28/09, 05/10, 12/10, 19/10,
26/10, 02/11, 09/11, 16/11 e 23/11/2026. São propostas de produto da Linktrac,
não uma confirmação de contratação, disponibilidade de equipamentos ou integração comercial.

## Implementado nesta atualização

- **DPF e regeneração:** modelo JSON normalizado com fuligem em %, luz do DPF,
  estado de regeneração e contagem de regenerações interrompidas. A tela de telemetria mostra
  valores recebidos, inclusive zero/falso. A análise de manutenção usa referências do fabricante
  cadastradas por veículo, identifica dados antigos e apresenta evidências para inspeção.
  Não usa limiar universal, não estima data de quebra e não comanda regeneração.
- **Firmware de rastreadores e câmeras:** registro de versão atual, disponível, data da última
  atualização, recursos e falhas. O histórico do equipamento preserva as informações antes/depois
  das edições e transferências. É um registro operacional, sem atualização OTA genérica.
- **Aplicativo do motorista:** acesso separado do pareamento familiar, lembrete pessoal de ponto,
  abertura do fornecedor e dispensa do aviso. A identificação exige informação enviada pelo
  equipamento autenticado e ignição ligada. Não há reconhecimento facial ou ponto automático.
- **Canal de notificações:** código Android/iOS e fila de envio implementados, com destino protegido,
  autorização explícita, controle de usuário/empresa, expiração e recibos. A tela bloqueada recebe
  apenas aviso genérico. Credenciais Expo/FCM/APNs e teste físico continuam necessários.
- **Fila de briefings:** leitura de Markdown, tabelas, listas simples e numeradas. Há um botão
  para importar as nove edições incluídas nesta versão. Reimportação preserva revisões existentes.
  Importar propostas não aplica código nem marca funcionalidades como concluídas.

## Dependências que não foram simuladas como concluídas

- DPF exige veículo e equipamento que forneçam esses sinais; protocolos CAN e escalas devem
  ser normalizados conforme o fabricante. Não foram inventados atributos de protocolos proprietários.
- BWS 4G/LoRa, dados de montadoras, AEMP e outros conectores comerciais exigem protocolo,
  documentação, autorização de acesso e teste de equipamento/conta.
- Atualização remota de firmware depende de transporte de comando e procedimento do fabricante.
- Push exige configuração externa e teste real com tela bloqueada. O servidor permanece sem
  enviar notificações se não estiver explicitamente configurado.
- Face, voz, checklist com foto, SOS e avaliação de alertas de vídeo continuam propostas
  separadas; não fazem parte da entrega deste aplicativo.
- A integração Sólides mantém armazenamento protegido e teste inicial de acesso; não sincroniza
  colaboradores ou batidas e não substitui o coletor oficial do fornecedor.

## Verificação

Regras de DPF, firmware, importação e envio são cobertas por testes do servidor. O aplicativo
tem testes de sessão e revogação, além de typecheck e lint. O teste local
`backend/scripts/verificar-jornada-isolada.js` usa banco temporário em replica set,
cadastros sintéticos e provedor de push simulado, sem informações reais de funcionários.

Fontes técnicas utilizadas para implementação:

- Expo SDK 58 Notifications: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/
- Envio e recibos: https://docs.expo.dev/push-notifications/sending-notifications/
- Exemplo de documentação técnica DPF por fabricante: https://www.fordservicecontent.com/ford_content/catalog/motorcraft/DOBDSM1202.pdf

Os critérios e procedimentos de cada veículo precisam ser conferidos no respectivo manual;
o exemplo de fabricante não fornece parâmetros universais para a frota.
