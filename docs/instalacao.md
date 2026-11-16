# Como instalar e executar o LINKTRAC PRIME

## Pré-requisitos

- Node.js instalado
- Conta no MongoDB Atlas

## Passo a Passo

1. Clone o repositório.
2. Configure os arquivos de ambiente:
   - Copie `backend/.env.example` para `backend/.env` e ajuste `MONGO_URI`, `FRONTEND_URL`, `JWT_SECRET` e, se desejar, `REGISTER_SECRET` e `DEVICE_API_TOKEN`.
   - Copie `frontend/.env.example` para `frontend/.env` e ajuste `VITE_API_URL`, `VITE_GOOGLE_MAPS_KEY` e `VITE_OPENROUTE_KEY`, se necessário.
3. No terminal execute:

### Backend

```bash
cd backend
npm install
npm run dev
```

Para verificar a qualidade do código e executar testes:

```bash
npm run lint
npm run test
```

### Frontend

```bash
cd frontend
npm install
# Copie .env.example para .env e ajuste as variáveis, se necessário
npm run dev
```

Para verificar a qualidade do código e executar testes:

```bash
npm run lint
npm run test
```

Por padrão, o backend roda em `http://localhost:5000` e a interface em `http://localhost:5173`.

### Opcional: Docker

Se preferir rodar via Docker, use o `docker-compose.yml` do projeto:

```bash
docker compose up --build
```

## Identificação por uma base TAC licenciada

Configure TAC_BASE_ARQUIVO no .env do backend com o caminho absoluto de um arquivo JSON obtido de um fornecedor autorizado. Mantenha o arquivo fora do repositório e converta os dados do fornecedor para uma lista de objetos com os campos tac, fabricante e modelo. O TAC deve ser texto com oito dígitos, inclusive quando começa com zero. Exemplo fictício de estrutura:

    [
      { "tac": "01234567", "fabricante": "Fabricante Exemplo", "modelo": "Modelo Exemplo" }
    ]

Reinicie o backend ao configurar, substituir ou corrigir a base. O LINKTRAC procura primeiro o IMEI nos cadastros da empresa. Depois usa os oito primeiros dígitos para consultar o arquivo local. Entradas conflitantes para o mesmo TAC são ignoradas. Se a base não estiver disponível ou não contiver o TAC, o fluxo continua com sugestões dos cadastros da empresa, busca no catálogo e preenchimento manual. A consulta ao arquivo não faz chamadas a terceiros.

## Roteirização de entregas

Em Roteirização de entregas, escolha o veículo. Leia uma chave de DANFE em código de barras ou QR Code, digite o código da etiqueta ou importe até 20 XMLs de NF-e/NFC-e por vez. A leitura do código procura uma parada já cadastrada e pode iniciar um rascunho. Para nota nova, o XML fornece os dados, com preferência pelo endereço de entrega quando presente. O navegador lê o XML e a API salva apenas os campos revisados do cadastro. O sistema não consulta a SEFAZ por chave.

Para liberar a área ao entregador, crie uma conta com perfil motorista e use o mesmo e-mail em um único cadastro ativo de motorista da empresa. Crie um vínculo vigente em Central operacional → Motoristas e veículos para habilitar inclusão de paradas naquele veículo. Atribua a entrega ao motorista para que ele possa consultá-la e concluir a parada. A câmera e a localização do celular exigem HTTPS, exceto em localhost.

Selecione até 50 paradas com coordenadas confirmadas, defina a saída e calcule a rota. O plano considera janela de atendimento, tempo de serviço e retorno opcional. A sequência é uma sugestão, com preferência por menos atrasos e menor tempo total. As entregas e seus status ficam salvos. O cálculo da sequência é feito por veículo e não é salvo como despacho.

Para geocodificação, configure TMS_GEOCODIFICADOR_URL com o endereço de uma instância própria ou autorizada compatível com o endpoint search do Nominatim. A busca envia ao provedor apenas o endereço digitado ou extraído. Para roteamento por ruas, configure TMS_OSRM_URL com uma instância OSRM v5 com o perfil driving e cobertura da operação. O roteador recebe coordenadas, sem nomes, chaves ou XML. A API usa os serviços table e route e não assume trânsito em tempo real. Sem provedores, use coordenadas ou marque pontos no mapa e obtenha uma estimativa em linha reta.

A tela Roteirização de entregas permite ao gestor criar uma viagem de contêiner com retirada no terminal, entrega e devolução do vazio. Cada etapa tem endereço, localização, janela e duração próprios. O sistema salva as três paradas juntas. Quando uma etapa anterior estiver pendente, inclua-a na rota. A próxima etapa só pode começar ou ser concluída depois da anterior. Para o motorista acompanhar a viagem, atribua-o no cadastro.

Use Nova rota com trocas para registrar um circuito com várias coletas, entregas e descargas. Informe a capacidade em unidades e os contêineres a bordo na partida. Em cada parada, informe os números e a ordem das movimentações. Descarregar muda um contêiner de cheio para vazio e o mantém a bordo. Deixar cheio ou deixar vazio retira a unidade do veículo. O sistema bloqueia combinações incompatíveis e calcula a carga prevista após cada parada.

As paradas de troca seguem a sequência indicada pelo gestor. Para planejar várias coletas e devoluções no mesmo circuito, inclua-as na mesma viagem de troca. O TMS não combina duas viagens de contêiner em uma rota que contém trocas. O motorista confirma a conclusão de cada parada e pode consultar a movimentação prevista no histórico. Capacidade em unidades não substitui cálculo de peso ou restrições viárias de caminhão.
## Arquivo de histórico de localização e telemetria

O modo inicial copia posições GPS e telemetria sem GPS de uma janela móvel de 365 dias. Os 30 dias mais recentes ficam no banco principal para consulta direta. A cópia mantém a origem. O procedimento vale apenas para as duas coleções de leituras.

1. Em homologação, configure `HISTORICO_ARQUIVO_URI` e `HISTORICO_ARQUIVO_BANCO` no backend. Use um nome diferente do banco principal e uma conexão privada. Comece com dados de teste.
2. Execute `node scripts/arquivar-historico.js` dentro da pasta `backend`. A primeira execução cria índices nas duas coleções, na origem e no arquivo. Planeje essa operação com o responsável pelo banco quando houver volume de produção.
3. Repita o comando para continuar do último lote verificado. Agende a execução fora do processo web quando o teste passar. Cada execução processa até dez lotes de 500 por fluxo, com um fluxo para data de medição e um para leituras recebidas com atraso, em cada coleção.
4. Abra **Central operacional → Arquivo de histórico** com a conta de administração Linktrac. Confira a data da última verificação, o registro mais antigo e a posição da cópia.
5. Teste consultas recentes, consultas antigas, CSV, KML e a API de parceiros. Desconecte o arquivo em homologação. Consultas cuja janela começa nos últimos 30 dias continuam no banco principal. Consultas que possam incluir datas anteriores sinalizam o período afetado com HTTP 503.

Antes do uso em produção, valide backup e restauração do arquivo, monitore a vazão de cópia com a carga alvo e planeje o descarte de leituras fora da retenção. O descarte exige uma etapa de implantação própria.

## Cadastro financeiro e contrato

1. Configure no servidor uma chave persistente de 32 bytes em hexadecimal na variável `FINANCEIRO_CHAVE_CRIPTOGRAFIA`. Gere uma chave com `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"` e guarde-a no gerenciador de segredos do servidor.
2. Em **Clientes → Conta de cobrança e modelo**, conecte a chave do Asaas da própria empresa. Use o ambiente de teste e clientes fictícios para homologar. Administradores de revendedoras fazem a configuração na própria conta, para a própria carteira.
3. Na mesma tela, envie um modelo Word (.docx) de até 4 MB. Inclua os campos `{cliente_nome}`, `{cliente_cpf_cnpj}` e `{lista_veiculos}`. A interface lista os demais campos disponíveis.
4. Ao cadastrar um cliente, marque **Preparar cadastro para cobrança e contrato** e informe os dados do pagador. Para cadastros anteriores, abra **Financeiro e contrato**. O processamento ocorre em segundo plano e registra o vínculo com o pagador do Asaas. Em caso de confirmação inconclusiva, confira o registro na conta do Asaas.
5. Após cadastrar os veículos, selecione os que constam no contrato e baixe o Word preenchido. Revise e envie por seu canal de atendimento. Se precisar guardar a versão final, anexe o PDF de até 4 MB na ficha do cliente.

O cadastro financeiro prepara o pagador para emissão posterior. A emissão, o envio de boletos e a assinatura de contratos ficam fora deste fluxo.
## Aviso de perda de alimentação pelo WhatsApp

1. No WhatsApp Business da Meta, cadastre um modelo de utilidade em português do Brasil com dois campos posicionais. Use, por exemplo, “Alerta Linktrac. O veículo {{1}} perdeu a alimentação do rastreador em {{2}}. Verifique a bateria e a instalação.”
2. Após a aprovação do modelo, configure no backend `ALERTAS_EMPRESA_ID`, `ALERTAS_WHATSAPP_NUMERO_ID`, `ALERTAS_WHATSAPP_TOKEN`, `ALERTAS_WHATSAPP_VERSAO` e `ALERTAS_WHATSAPP_MODELO`. Use o identificador do número comercial da Meta e uma versão ativa da Graph API. Guarde o token no servidor.
3. Em **Veículos**, informe o celular brasileiro com DDD e marque a autorização somente após o cliente aceitar os avisos para aquele número.
4. Teste com um rastreador compatível e um destinatário autorizado. O equipamento precisa continuar comunicando após a perda de alimentação, normalmente com bateria interna. A detecção usa a transição explícita do sinal de alimentação ou o alarme Traccar `powerCut`. A confirmação de retorno da alimentação rearma o aviso. Registros atrasados e simulados ficam fora do disparo.
5. Em **Central operacional → Notificações internas**, confira a ocorrência e a situação do envio. O estado “Aceito pelo WhatsApp” indica aceitação pela API. Uma resposta inconclusiva fica sinalizada para evitar reenvio automático de uma mensagem que pode já ter sido aceita.

Em **Configurações → WhatsApp Business**, a administração Linktrac pode cadastrar o número comercial digitando apenas o telefone com DDD. Se a conexão ainda estiver pendente, salve o número e repita **Salvar número** após a configuração do servidor. O token precisa ter acesso à leitura do número comercial na Meta e ao envio de mensagens. A plataforma compara o telefone digitado com o número da conta conectada. Uma configuração anterior feita apenas no servidor continua operando até que um número seja salvo na tela.
## Central de monitoramento

No menu **Operação → Central de monitoramento**, consulte as ocorrências abertas, em atendimento ou encerradas. Um novo alerta de perda de alimentação abre uma ocorrência de prioridade alta para a empresa do veículo. O mapa identifica a última posição registrada, com data e hora.

Administradores, gestores e operadores com permissão para configurar **Operação** podem assumir atendimentos. Quem assumiu pode registrar ações e encerrar com um desfecho obrigatório. Administradores e gestores podem acompanhar e atualizar os atendimentos da empresa.

Para testar, acesse **Simular alerta**, selecione um veículo próprio e clique em **Criar ocorrência de teste**. Abra a ficha, assuma, registre uma ação e encerre. A ocorrência aparece identificada como simulação e não gera envio externo. A fila se atualiza a cada 10 segundos.

O alerta **Movimento com a ignição desligada** usa três posições recentes e consecutivas do mesmo rastreador, todas com ignição explicitamente desligada. Exige dois trechos compatíveis com deslocamento e pelo menos 60 metros entre a primeira e a terceira posição. Leituras sem sinal, saltos incompatíveis e intervalos longos interrompem a sequência. O alerta abre uma ocorrência interna de prioridade alta e também pode ser escolhido em **Simular alerta**.

## Chips e estoque

Em **Central operacional → Chips e estoque**, cadastre o ICCID e a operadora. Vincule o chip a um equipamento ativo da própria empresa. A ficha mostra o veículo associado e o histórico guarda as movimentações com data, hora, usuário, origem e destino disponíveis.

Se o equipamento mudar de veículo na mesma empresa, o chip acompanha o vínculo. Se for desativado, excluído ou transferido para outra empresa, o chip volta ao estoque da empresa de origem. Para informar a validade da garantia, use **Equipamentos e credenciais → Editar → Garantia até**.

## Replay do trajeto

Em **Rastreamento → Histórico e trajeto**, consulte um período e abra **Replay do trajeto**. Use **Reproduzir**, **Pausar**, os botões de ponto anterior e próximo ou a barra de posição. O marcador amarelo acompanha os pontos registrados em ordem de horário. A velocidade do replay acelera a reprodução e as lacunas superiores a cinco minutos são sinalizadas. Consultas continuam sujeitas ao limite de posições do histórico.

## Prévia da cobrança mensal

Em **Clientes → Financeiro e contrato**, informe o preço do rastreamento por veículo e selecione os adicionais previstos no contrato. Telemetria e telemetria completa são modalidades alternativas. Cada valor se aplica a toda a frota contabilizada deste contrato.

A prévia da próxima competência usa a frota ativa na data da consulta e exclui veículos de simulação. Para uma revendedora, soma a frota própria e a dos seus clientes ativos. **Simular cobrança** calcula a proposta com os valores digitados e veículos adicionais sem gravá-los. **Salvar plano** registra os valores para as próximas consultas. O cálculo é uma estimativa, sem ciclo fechado ou emissão de cobrança.
## Agro, talhões e horímetro

Em **Operação → Agro e talhões**, delimite um talhão no mapa. Para consultar uma operação, selecione a máquina, informe um intervalo de até 24 horas e a largura do implemento em metros. A plataforma estima a faixa coberta dentro do talhão pela união de células da malha e usa posições com ignição ligada e velocidade de trabalho. Sobreposição de passagens conta uma vez por célula. O cálculo é aproximado e depende da qualidade e frequência do GPS.

Em **Central operacional → Manutenção preventiva**, registre o horímetro da última revisão e o intervalo de trabalho em horas. Quando a telemetria atingir o limite, a notificação interna informa a leitura e o alvo. Ao concluir a revisão, atualize a data e o horímetro no plano. O aparelho deve enviar `telemetria.horimetroHoras` em horas.
