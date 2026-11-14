# LINKTRAC PRIME

### Teste sem rastreador físico

Após configurar o banco e a empresa Linktrac, execute `npm run simulate:tracking` na pasta `backend`.
O comando cria ou reutiliza somente o veículo `TESTE01`, identificado como TESTE / SIMULACAO,
e grava oito posições fictícias em Brasília, com intervalo de três segundos. Cada posição é
validada pelos controllers de rastreamento e consultada novamente no banco. O script encerra
automaticamente; o veículo e suas posições permanecem disponíveis para consulta.
Se a placa já pertencer a outro veículo, o comando interrompe sem alterar esse cadastro.
Não reconfigura aparelhos nem acessa a Intertrack.

Na tela Rastreamento, consulte `TESTE01` e marque **Atualizar a cada 5 segundos** durante uma
execução. A tela identifica a simulação e oferece **Ver posição no mapa** (OpenStreetMap em
outra aba). O comando é uma ferramenta local de teste: não verifica a autenticação HTTP de
dispositivos nem substitui uma validação com rastreador real.

## Rastreamento Veicular

Sistema completo para cadastro, monitoramento e consulta de localização de veículos em tempo real.

### 🛠️ Tecnologias

- **Backend:** Node.js, Express, MongoDB, Mongoose
- **Frontend:** React, Vite, Axios, React Router DOM
- **Banco de Dados:** MongoDB Atlas
- **Estilo:** Identidade visual LINKTRAC PRIME

### 🚀 Como executar

#### Backend

```bash
cd backend
npm install
npm run dev
```

Para verificar a qualidade do código e os testes:

```bash
npm run lint
npm run test
```

#### Frontend

```bash
cd frontend
npm install
# Copie .env.example para .env e ajuste as variáveis de ambiente
npm run dev
```

Para verificar a qualidade do código e os testes:

```bash
npm run lint
npm run test
```

A API fica acessível em `http://localhost:5000/api` e o frontend em `http://localhost:5173`.

### 🔐 Variáveis de ambiente importantes

- `JWT_SECRET` — chave secreta para assinar tokens de autenticação.
- `REGISTER_SECRET` — código opcional para proteger a criação inicial de clientes/usuários.
- `DEVICE_API_TOKEN` — token opcional para autenticar dispositivos que enviam telemetria em `POST /api/rastreamento`.

### 📌 Endpoints principais

- `POST /api/veiculos` — cadastrar veículo
- `GET /api/veiculos` — listar veículos
- `GET /api/veiculos/:placa` — buscar veículo por placa
- `POST /api/rastreamento` — atualizar posição do veículo
- `GET /api/rastreamento/:placa` — consultar última posição do veículo

### Sessão e recebimento de posições

Ao restaurar uma sessão, um token recusado (`401`) exige novo login. Falhas de conexão ou indisponibilidade do banco preservam o token e apresentam a opção **Tentar novamente**.

O envio de posições usa o cabeçalho `x-device-token` quando `DEVICE_API_TOKEN` está configurado. Cada posição é gravada uma única vez no veículo de origem. Havendo cadastros independentes com a mesma placa, o dispositivo deve informar também o `veiculoId` de origem; o sistema não distribui posições automaticamente entre empresas.

### Espelhamento autorizado pela Linktrac

Espelhar significa conceder a outra empresa acesso de consulta ao veículo original e ao seu histórico, sem transferir a propriedade nem duplicar o cadastro ou as posições. O veículo passa a aparecer na lista e no rastreamento da empresa autorizada. Somente a administração Linktrac pode conceder ou revogar esse acesso.

Configure `LINKTRAC_CLIENT_ID` no backend com o ID da empresa Linktrac já cadastrada. Somente usuários `admin` dessa empresa poderão acessar **Espelhamentos** no menu. Sem essa configuração, a gestão de espelhamentos permanece bloqueada. Os administradores das demais empresas não recebem essa permissão.

Se a empresa Linktrac ainda não existir, execute no terminal do VS Code, na pasta raiz deste projeto:

```bash
npm --prefix linktrac/backend run setup:linktrac
```

O assistente local solicita nome, e-mail e uma senha de pelo menos 12 caracteres (até 72 bytes). A senha e sua confirmação não aparecem no terminal e não são salvas no `.env`. O processo cria a empresa e o administrador em uma transação no MongoDB e configura `LINKTRAC_CLIENT_ID` automaticamente. É necessário um banco com suporte a transações, como MongoDB Atlas ou um replica set. Depois, reinicie o backend e faça login. `LINKTRAC_ADMIN_EMAIL` pode definir apenas o e-mail sugerido no assistente.

O assistente não altera usuários existentes nem transforma uma empresa cliente em Linktrac. Se o e-mail ou o identificador `linktrac` já estiver em uso, ele interrompe a configuração para que o cadastro existente seja conferido. Se a conta for criada e a gravação do `.env` falhar, ele informa o ID que deve ser configurado manualmente.

Na tela **Espelhamentos**, selecione o veículo junto à sua proprietária e a empresa que receberá acesso. **Autorizar espelhamento** cria o vínculo; **Revogar acesso** remove a permissão nas próximas consultas, sem alterar o acesso da proprietária ou apagar histórico.

Rotas administrativas autenticadas:

- `GET /api/espelhamentos` — listar veículos, proprietárias e empresas para administrar os vínculos.
- `PUT /api/espelhamentos/:veiculoId/clientes/:clienteId` — autorizar acesso (sem duplicar vínculos).
- `DELETE /api/espelhamentos/:veiculoId/clientes/:clienteId` — revogar acesso.

As consultas de veículo e rastreamento aceitam `?veiculoId=...`, utilizado pelos links da lista para identificar o veículo correto mesmo se existirem placas iguais em cadastros independentes. O identificador não dispensa a verificação de propriedade ou espelhamento. Cópias de veículos e posições que já existam não são mescladas nem removidas automaticamente.

Os testes de integração executam as rotas HTTP e a criptografia de senhas, com persistência simulada. Eles não substituem a validação com MongoDB e rastreador reais.

### 🎨 Paleta de Cores

- Azul Principal: `#0066CC`
- Azul Escuro: `#003366`
- Azul Claro: `#0099FF`
- Cinza Claro: `#E5E9F2`
- Branco: `#FFFFFF`

### Histórico e trajeto

Em Rastreamento, consulte uma placa para abrir Histórico e trajeto. A tabela e o mapa
exibem as últimas 500 posições, em ordem cronológica. Use Início e Fim para limitar
o período; os campos usam o horário local do dispositivo. Consultar histórico atualiza
a lista; Limpar período volta às posições mais recentes. O histórico tem atualização
manual, independente da atualização automática da última posição.

A rota autenticada GET /api/rastreamento/:placa/historico aceita veiculoId, inicio e fim
(datas ISO com fuso horário). Aplica as mesmas permissões de propriedade e espelhamento
da consulta de última posição. Retorna dados, quantidade, limite e limitado; limitado=true
indica que há outros registros fora dos 500 retornados. Não modifica as posições.

O mapa usa Leaflet e OpenStreetMap, com início verde e fim vermelho. A linha conecta
os registros; não calcula ruas, distância percorrida ou uma rota de navegação. Os pontos
e a tabela continuam disponíveis se as imagens do mapa falharem. VITE_MAP_TILE_URL
permite configurar um servidor de mapas compatível, observando sua atribuição/licença.
### Viagens e paradas estimadas

O histórico inclui atividade, com trechos de viagem/parada, resumo de tempos e distância
aproximada por linhas entre pontos em movimento. Cada intervalo entre duas amostras válidas
é classificado pela velocidade da primeira: acima de 5 km/h é movimento; até 5 km/h é parada.
A data final não é extrapolada além da última posição. As viagens não representam ciclos de
ignição nem garantem início/fim reais; filtros e o limite de 500 registros recortam os trechos.
Intervalos acima de 5 minutos, sem sinal, com coordenadas ou velocidades inválidas são
classificados como desconhecidos e separam trechos. Nenhuma nova coleção é criada.
A distância não é hodômetro nem roteamento pelas ruas. Consulte Viagens e Paradas abaixo
do filtro de histórico para alternar entre as listas. Os limites de acesso por empresa e
espelhamento continuam sendo aplicados pela mesma rota de consulta autenticada.
### Alertas, ignição, manutenção e auditoria

O menu Históricos reúne quatro consultas. Alertas e Ignição usam até 500 posições recentes,
com as mesmas permissões de propriedade/espelhamento. A consulta informa quando é parcial.
Alertas são calculados ao consultar (não são notificações): cada amostra acima de 80 km/h,
intervalos acima de 5 minutos e última posição desatualizada. Os valores são fixos nesta versão;
a tela antiga de Configurações não altera esses limites. Não há envio de WhatsApp ou e-mail.

POST /api/rastreamento aceita ignicao booleano ou null. Ausência não significa desligada.
A origem é marcada pelo servidor: TESTE/SIMULACAO é simulado; os demais são dispositivo.
A lista distingue estado observado de mudança entre amostras próximas. Não infere ignição
pela velocidade nem reconstrói dados antigos. O simulador inclui ignição e um ponto a 90 km/h.

GET /api/historicos/:veiculoId/eventos retorna alertas e ignição. GET e POST em
/api/historicos/:veiculoId/manutencoes são exclusivos da empresa proprietária; somente admin
ou gestor registra serviços. Cada registro mantém data do serviço, descrição, custo inteiro
em centavos, quilometragem e próxima data/quilometragem opcionais. Registros são aditivos,
sem edição/exclusão nesta versão. Não há previsão automática de desgaste. A tela Manutenção
agora abre esse cadastro real, substituindo a lista demonstrativa anterior.

GET /api/historicos/acoes é restrito a admin/gestor e à própria empresa. A auditoria registra
logins e operações HTTP de cadastro/alteração/revogação bem-sucedidas a partir da ativação.
Guarda somente empresa, ator, método, caminho sem query, status e data. Não salva senhas,
tokens ou payload. Consultas, falhas de login, scripts locais e mudanças diretas no banco
não são auditados. Falha de gravação da auditoria não desfaz a operação principal: gera
aviso no servidor e cabeçalho X-Linktrac-Auditoria: indisponivel. Não é auditoria transacional
nem sistema de conformidade. Listas de manutenção e auditoria mostram até 500 registros.

Validação com TESTE01: oito novas posições simuladas, três estados/mudanças de ignição,
um alerta de velocidade e uma manutenção fictícia de custo zero. Nenhum rastreador físico
foi reconfigurado. Registros de manutenção de exemplo têm descrição iniciada por SIMULAÇÃO.
### Manuais de uso por aba e perfil

Cada página publicada tem um painel recolhível Manual de uso acima de seu conteúdo.
Nas quatro abas de Históricos, o painel acompanha a aba selecionada. O conteúdo muda
conforme o perfil autenticado: admin e gestor recebem uso, gestão e preenchimento dos
campos; operador e motorista recebem somente instruções de uso e orientação de suporte.
O guia administrativo de Espelhamentos exige podeGerenciarEspelhamentos, exclusivo da
administração Linktrac. Outras empresas recebem a explicação de consulta compartilhada.
Antes do login, apenas os guias de acesso e orientação do cadastro inicial são mostrados.

Os guias descrevem os recursos efetivamente presentes e identificam Relatórios,
Gestão de Cargas e Configurações como demonstrativos quando aplicável.
Não concedem permissões nem mudam cadastros. A separação empresa/usuário utiliza os
perfis existentes da plataforma; não introduz uma nova categoria de empresa.
Conteúdo em frontend/src/ajuda/manuais.js; apresentação em componentes/ManualUso.jsx.
### Identidade visual Linktrac

O layout usa o logo oficial fornecido em LOGO.jpeg, copiado sem alterações para
frontend/src/assets/images/linktrac-logo.jpeg. A navegação lateral agrupa Operação,
Gestão e Administração; os links de Usuários e Espelhamentos respeitam os perfis.
Em telas menores, o botão de menu abre a navegação e Escape ou o toque fora a fecha.
O tema compartilhado fica em frontend/src/styles/theme.css. O painel foi reorganizado
com indicadores explicitamente demonstrativos e atalhos para consultas reais.
Os manuais por perfil, os dados e os contratos de integração foram preservados.
A página passou a usar idioma pt-BR e título Linktrac | Gestão e rastreamento.
### Painel conectado aos dados da empresa

O painel principal agora consulta GET /api/painel, com autenticação e filtro de propriedade
ou espelhamento. Esta implementação substitui os antigos números demonstrativos do painel.
Frota real exclui veículos TESTE/SIMULACAO. O TESTE01 continua consultável em uma seção
separada, e suas posições e serviços não entram nas contagens reais. Uma frota vazia é
válida; não é necessário cadastrar veículos fictícios para usar ou organizar o sistema.

Em movimento exige posição real válida recebida nos últimos cinco minutos e velocidade
acima de 5 km/h. Atenção conta cada veículo uma vez quando não tem posição recente válida
ou quando a última posição excede 80 km/h. Serviços registrados conta somente registros
de veículos reais da própria empresa; manutenção de veículos espelhados não é exposta.
Os cartões mostram a fotografia da consulta e são renovados por Atualizar painel. Erros
mostram indisponibilidade, sem converter falhas em contagens zero. Não há contador de motoristas no painel nesta versão.
### Cadastro persistente de motoristas

Motoristas agora salva e atualiza os dados no MongoDB. Esta implementação substitui a
lista temporária anterior. GET /api/motoristas aceita busca por nome, situacao e pagina,
com 20 registros por página; somente a empresa da sessão é consultada. POST /api/motoristas
e PUT /api/motoristas/:id exigem admin/gestor. Não há exclusão: a situação pode ser alterada
para inativo ou ferias. Operações de escrita entram na auditoria HTTP existente.

CPF e CNH têm validação de formato de 11 dígitos e índices únicos por empresa. CPF aceita
pontuação, normalizada ao salvar. Não há validação oficial dos documentos. Datas inválidas,
campos fora dos limites e categorias/situações desconhecidas são rejeitados. CNH vencida
pode ser cadastrada e aparece destacada na lista. Administradores e gestores recebem os
dados completos para edição; operadores e motoristas recebem apenas ID, nome, situação,
categoria e validade, sem documentos ou contatos pessoais. Espelhamento não compartilha
motoristas. Cadastros não criam usuários de login nem vínculos com veículos.

A lista pode começar vazia, independentemente da existência de veículos. Nenhum motorista
de teste foi criado no banco ao validar esta entrega. O manual da aba foi atualizado para
explicar cada campo, a busca, a edição e as permissões.