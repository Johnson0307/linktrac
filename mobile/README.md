# Linktrac Família — Android e iOS

## Versão 0.2.0: acesso Motorista

Na tela inicial, **Entrar como motorista** abre um acesso separado do pareamento familiar.
Use a conta de perfil Motorista e o mesmo e-mail do cadastro ativo da empresa, com módulo
Operação liberado. Este módulo não inicia GPS nem registra ponto oficial.

O aplicativo salva apenas uma credencial opaca própria em SecureStore; senha e JWT de login
não são persistidos. A sessão dura até 30 dias, mas o servidor confere usuário, empresa e
vínculo a cada consulta/envio. Para sair, é preciso conexão para revogar o destino de avisos;
se a conta foi bloqueada, a desconexão continua permitida.

O motorista autoriza notificações explicitamente. O aviso na tela bloqueada é genérico,
sem placa, nome, coordenadas ou identificador de funcionário. Ao tocar, abre a tela Motorista,
que consulta os próprios lembretes. **Dispensar lembrete não bate ponto.**

### Configuração de notificações (ainda necessária para envio real)

- Projeto Expo da Linktrac, FCM v1 no Android e APNs no iOS.
- No build: `EXPO_PUBLIC_EAS_PROJECT_ID` (UUID público do projeto).
- No build Android: `LINKTRAC_GOOGLE_SERVICES_FILE` aponta ao `google-services.json`
  do pacote `br.com.linktrac.familia`. O arquivo não entra no Git.
- Credenciais de envio FCM/APNs configuradas no projeto Expo, com segurança adicional de push.
- No servidor privado: `PUSH_MOTORISTA_EXPO_PROJECT_ID`,
  `PUSH_MOTORISTA_EXPO_ACCESS_TOKEN`, `PUSH_MOTORISTA_HABILITADO=1` e a chave de
  proteção de integrações já usada pela plataforma. Nunca trocar a chave existente.
- No iPhone: assinatura e conta Apple Developer. Não há IPA assinada neste projeto.
- O app sem essas configurações mostra a pendência e mantém consulta com tela aberta.
  Uma compilação sem credenciais não comprova recebimento com tela bloqueada.

Teste em celular físico: identificação + ignição, app aberto/fechado, tela bloqueada,
falta e retorno de internet, permissão negada, saída da conta e bloqueio do usuário.
Expo/FCM/APNs podem atrasar ou perder notificações; recibo do provedor não confirma
recebimento ou leitura pelo motorista. O servidor expira avisos de push após 3 minutos,
revalida o ciclo da ignição e confere os recibos. Não existe garantia de entrega imediata.

Documentação oficial: https://docs.expo.dev/versions/v58.0.0/sdk/notifications/
e https://docs.expo.dev/push-notifications/sending-notifications/ .

Aplicativo React Native/Expo com uma base compartilhada para o celular acompanhado.
O responsável continua usando o painel web Pessoas e família. Não é um aplicativo para
monitoramento oculto: o compartilhamento exige ação no próprio celular e permissões do sistema,
tem indicação visível e pode ser interrompido pelo usuário do aparelho.

## Entrega e limites

- Pareamento de uso único com a API existente, sem login do responsável no celular do menor.
- Credencial no Android Keystore/iOS Keychain via SecureStore; não entra em URLs ou logs.
- Tarefa nativa de localização Android/iOS, aviso Android e indicador de localização iOS.
- Iniciar, interromper, remover pareamento e abrir painel do responsável no navegador.
- Envio de posições no máximo a cada 30s por fix aceito; distância sugerida de 15m.
  O sistema pode espaçar os callbacks, especialmente em repouso; não há SLA de 30s.
- Fila protegida com 32 slots (cada item <2KB), reenvio com IDs estáveis e deduplicação no servidor.
- Sem confirmação da autorização por 5 minutos, a próxima execução da tarefa interrompe GPS
  e apaga a fila. Não se promete interrupção remota instantânea em aparelho offline/desligado.
- Não reinicia coleta automaticamente pela interface após falha de tarefa/permissão. Início explícito.
- Não há SMS, captura de rosto, SOS, cerca familiar ou consulta de localização por IMEI/telefone.

## Pré-requisitos para teste real

1. Publicar o backend e frontend compatíveis deste projeto, mantendo o app desligado inicialmente.
2. Validar o termo adicional e o procedimento de atendimento/privacidade para o piloto.
3. Habilitar `FAMILIA_APP_HABILITADO=1` na configuração privada do backend e reiniciar a API.
   Sem isso, o aplicativo não consome códigos. A versão web continua independente.
4. O responsável abre Pessoas e família, seleciona **Autorizar aplicativo em segundo plano**,
   lê o termo adicional e registra os dois aceites. As aprovações anteriores de identidade/vínculo
   e o termo principal continuam obrigatórios. Nenhum cadastro existente ganha esse aceite sozinho.
5. Gerar código em **Adicionar ou trocar aparelho**. Um código novo invalida o aparelho anterior.
6. Instalar uma compilação própria do Linktrac Família no celular do menor.
7. Digitar o código e um nome livre (ex.: Celular do João). Tocar **Parear este aparelho**.
8. Tocar **Iniciar compartilhamento**, ler o aviso e conceder permissões de localização.
   No iPhone, permitir **Sempre**; no Android, permitir o acesso em segundo plano quando solicitado.
9. O responsável acompanha em **Ver localização e histórico**, em sua própria conta.

O código entra no celular do menor; o responsável gera o código e acompanha pelo painel.
WhatsApp pode apenas transportar o link da versão web; não participa do rastreamento deste app.
Nome do aparelho não é número de telefone, IMEI ou senha. Não são necessários nesse campo.

O termo adicional é distinto do termo web porque amplia a coleta à tela bloqueada e usa
armazenamento protegido persistente no celular. Revogar o termo principal bloqueia ambos.

## Desenvolvimento e verificações

Node compatível com Expo SDK 58, npm e dependências nativas do sistema:

```sh
npm ci
npm run typecheck
npm test
npm run bundle
npm run config:check
npm run native:generate
```

`bundle` exporta JavaScript/Hermes para Android e iOS. Isso **não produz APK/IPA** nem comprova
o funcionamento em aparelhos reais. Expo Go não é suficiente para validar localização em segundo plano.
`native:generate` gera diretórios Android/iOS conforme suporte do sistema; Windows gera Android.

### Android

Com Android Studio/SDK/JDK configurados, `npm run android` compila/instala a versão de desenvolvimento.
Para teste distribuído, usar EAS com o perfil `preview` de `eas.json` ou uma compilação local
release assinada para teste. A chave de produção deve pertencer à Linktrac e ficar fora do Git.
O template Android local pode usar assinatura de desenvolvimento; não publicar esse artefato como
versão final da loja. Aplicativo de teste deve ser claramente identificado como piloto.

### iPhone

Compilação local exige macOS e Xcode; alternativamente, configurar EAS Build na conta da empresa.
É necessário acesso à conta Apple Developer e assinatura/provisionamento adequados para instalar
em iPhone físico. TestFlight/loja exigem cadastro e revisão na Apple. O projeto não inclui credenciais,
perfil de provisionamento, associação a uma conta Expo ou envio automático às lojas.
Identificadores propostos: `br.com.linktrac.familia` para as duas plataformas; confirmar disponibilidade
e titularidade antes da distribuição comercial.

### Antes de distribuir

- Testar em Android e iPhone físicos: início, GPS aproximado/preciso, tela bloqueada, troca de app,
  perda/retorno da internet, troca de permissão, economia de bateria, encerramento forçado, revogação,
  novo pareamento, reconexão e remoção offline. Usar dados de teste autorizados.
- Confirmar consumo de bateria e intervalo efetivo em cada modelo; não prometer rastreamento contínuo.
- Conferir ícone/marca finais, política pública de privacidade, suporte e declarações de dados/permissões
  nas lojas. A revisão de localização em segundo plano e regras de público infantil precisa ser atendida.
- Não aceitar termos nem aprovar vínculo em nome do responsável.
- A auditoria npm de 20/11/2026 apontou vulnerabilidade moderada transitiva em minimatch usada pelo
  fingerprint do Expo (GHSA-g3hv-75wg-m249). Sem high/critical. Não aplicar downgrade forçado do SDK;
  acompanhar atualização compatível e não aceitar padrões de arquivos de terceiros no processo de build.

## Referências de implementação

- https://docs.expo.dev/versions/latest/sdk/location/
- https://docs.expo.dev/versions/latest/sdk/task-manager/
- https://docs.expo.dev/versions/latest/sdk/securestore/
- https://developer.android.com/develop/background-work/services/fgs/service-types#location
- https://developer.apple.com/documentation/corelocation/handling-location-updates-in-the-background
