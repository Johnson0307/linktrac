import { permite } from './acessos';

const manutencao = {
  titulo: 'Manutenção',
  objetivo: 'Consultar serviços realizados e a próxima revisão informada para o veículo.',
  uso: ['Selecione o veículo. A manutenção é visível somente para a empresa proprietária.', 'Leia a data, o serviço, o custo, a quilometragem e a próxima revisão na tabela.', 'Use Atualizar histórico para buscar registros recentes.'],
  limites: ['As próximas revisões são preenchidas pela empresa; não há previsão automática de desgaste nem envio de lembretes.', 'Veículos espelhados não dão acesso à manutenção da proprietária.'],
  empresa: {
    passos: ['Selecione um veículo da sua empresa.', 'Preencha Registrar serviço realizado, conferindo a data e os valores.', 'Clique em Registrar manutenção e aguarde a confirmação. O registro passa a aparecer na tabela e na auditoria.'],
    campos: [
      ['Serviço', 'Obrigatório. Descreva o trabalho realizado, com até 200 caracteres. Exemplo: troca de óleo e filtro.'],
      ['Data do serviço', 'Obrigatória. Informe a data em que o serviço foi realizado.'],
      ['Custo (R$)', 'Obrigatório. Informe o valor total em reais, com até duas casas decimais. Zero é permitido.'],
      ['Quilometragem (km)', 'Obrigatória. Informe o hodômetro no momento do serviço, em quilômetros inteiros, sem valor negativo.'],
      ['Próxima revisão em', 'Opcional. Data igual ou posterior à data do serviço.'],
      ['Próxima revisão aos km', 'Opcional. Quilometragem inteira maior que a registrada no serviço.'],
    ],
    observacoes: ['Somente administradores e gestores da empresa proprietária cadastram serviços.', 'Nesta versão, os registros não têm edição ou exclusão pela tela. Confira os dados antes de salvar.'],
  },
};
export const manuais = {
  familia: {
    titulo: 'Pessoas e família', objetivo: 'Acompanhar menores por localização compartilhada com o responsável verificado.',
    uso: ['Abra Pessoas e família e cadastre nome, nascimento e contato do responsável. A equipe precisa conferir identidade, maioridade e contato.', 'Adicione o menor, informe seu vínculo e leia o termo específico. O aceite fica associado à conta, ao menor, à versão, hash e horário do servidor; não é assinatura qualificada ICP-Brasil.', 'Solicite a conferência do vínculo à Linktrac. A declaração sozinha não aprova o cadastro. A análise precisa ser feita por outro administrador autorizado.', 'Após aprovação e autorização, use Adicionar ou trocar aparelho. O código expira em 15 minutos, serve uma vez e substitui o aparelho anterior.', 'No celular do menor, abra Página do aparelho (versão web) ou o aplicativo Linktrac Família instalado. Digite o código gerado pelo responsável e um nome livre, como Celular do João; não é telefone, IMEI nem senha. O app exige antes o aceite adicional em Autorizar aplicativo em segundo plano. No celular, toque em Iniciar compartilhamento e conceda as permissões. O responsável acompanha pela própria conta. WhatsApp não faz o rastreamento.', 'Consulte o mapa e até 500 posições recentes dentro de 14 dias. As consultas de localização são auditadas. Revogar interrompe o envio e remove as posições do banco ativo. Excluir cadastro também remove a identificação do menor.'],
    limites: ['Somente o titular da conta vê as próprias pessoas. A análise cadastral não dá acesso a coordenadas. O módulo é independente dos veículos e deve ser liberado pela administração para cada empresa.', 'Na versão web, mantenha a página aberta e ativa; o acesso fica somente na aba e fechá-la pode exigir novo pareamento. O app Linktrac Família Android/iPhone tem coleta nativa em segundo plano, com autorização adicional e indicação visível. O piloto depende de instalação própria e testes físicos; a distribuição iOS exige assinatura Apple. Tela bloqueada não garante envio ininterrupto: permissões, bateria, internet e encerramento forçado podem interrompê-lo.', 'A verificação é manual. Não há consulta automática a documentos, reconhecimento facial, SMS de confirmação ou validação automática de responsabilidade legal.', 'A coleta usa somente GPS permitido no aparelho. Não há localização por número de telefone/IMEI, compartilhamento público, convite a outros responsáveis, SOS ou alertas de cerca nesta versão.', 'Posições têm retenção de até 14 dias da coleta e não são exibidas após expirar, mesmo antes da limpeza TTL. Auditoria específica sem coordenadas: 180 dias. Cópias de segurança exigem ciclo restrito e reaplicação das revogações em restaurações.', 'Ao atingir 18 anos, a coleta e consulta por este fluxo ficam bloqueadas. Termo e procedimentos precisam de validação jurídica e operacional antes de atendimento comercial de pessoas reais.'],
  },
  jornada: {
    titulo: 'Jornada de trabalho e integração com ponto', objetivo: 'Preparar a conexão com o fornecedor de ponto e lembrar o motorista de conferir a entrada após identificação e ignição ligada.',
    uso: ['Abra Gestão → Jornada de trabalho. Em Configuração do fornecedor, escolha a empresa de ponto que você já utiliza.', 'O administrador informa a liberação somente após confirmação do fornecedor. Para Sólides, o token é salvo criptografado se a proteção estiver configurada no servidor. Nunca envie o token por mensagem.', 'O teste disponível consulta apenas o acesso inicial da Sólides. Não confirma o plano, a API de marcações nem o registro de ponto oficial.', 'Vincule o motorista ao ID ou identificador externo do colaborador no fornecedor. É um vínculo preparatório, sujeito à validação na primeira sincronização.'],
    limites: ['Esta versão não sincroniza marcações, não calcula horas trabalhadas e não coleta ponto oficial. O funcionário continua usando o aplicativo do fornecedor. O teste inicial da credencial não ativa a conexão nem confirma condições comerciais.', 'O administrador pode ativar Lembrete de ponto ao identificar o motorista. Exige identificador enviado pelo equipamento e ignição ligada; um vínculo administrativo não basta. O motorista ativo precisa ter o mesmo e-mail da própria conta e entrar na plataforma web com o módulo Operação liberado.', 'Mantenha a página aberta: o aviso é consultado a cada 30 segundos. No app 0.2.0, use Entrar como motorista. O suporte a avisos com tela fechada exige projeto Expo, credenciais FCM/APNs, permissão no celular e teste físico; sem configuração, o envio permanece indisponível. Dispensar o aviso não registra ponto. Não consultamos se o motorista já bateu a entrada; ele pode registrar antes da ignição no fornecedor.', 'Sólides está em preparação. VR/Pontomais, Pontotel, Oitchau, Senior e Outro registram a preferência; seus conectores dependem de documentação e implementação.', 'Cada empresa tem configuração e vínculos próprios. Trocar de fornecedor remove o token anterior; vínculos anteriores ficam preservados e separados por fornecedor.', 'Custos, API no plano gratuito, retenção e autorização para uso por clientes da Linktrac dependem da resposta e das condições do fornecedor.'],
  },
  tagsBle: {
    titulo: 'Tags BLE e homologação', objetivo: 'Identificar bens, máquinas e equipamentos por um receptor Bluetooth compatível.',
    uso: ['Abra Cadastros → Cadastro de tags. Escolha um modelo de referência ou informe marca e modelo.', 'Informe o bem e o identificador MAC, iBeacon (UUID:major:minor) ou Eddystone UID (Namespace + Instance). Escolha o receptor compatível.', 'Registre firmware, observações do teste e situação. O gestor confirma a homologação após testar a combinação real.', 'Consulte a última detecção, sinal e bateria quando enviados. O mapa mostra a posição aproximada do receptor. Histórico registra alterações com responsável, data e horário.'],
    limites: ['Modelos de referência não são homologados automaticamente. Confirme Bluetooth, firmware e formato no manual do receptor; o LV12 não foi validado para essa função.', 'Tags não possuem GPS próprio. RSSI não é convertido em distância. São guardadas a última detecção e a auditoria dos cadastros; não há histórico de deslocamento da tag.', 'Receptores Teltonika com atributos BLE decodificados podem encaminhar detecções. Outros integradores usam POST /api/integracao/tags-ble com as credenciais individuais do receptor, conforme a documentação da API.'],
  },
  painel: {
    titulo: 'Visão geral e mapa da frota', objetivo: 'Acompanhar a última posição dos veículos autorizados e os indicadores da frota.',
    uso: [
      'Abra Visão geral ou Mapa Geral e clique num marcador para ver placa, cliente, horário da posição e velocidade, quando disponível. Um marcador com número agrupa veículos no mesmo ponto.',
      'Use os botões + e − ou gire a rodinha do mouse sobre o mapa. Clique em Expandir mapa para usar a tela inteira e use Recolher mapa ou Esc para voltar.',
      'Abra Camadas do mapa para escolher o fundo e ligar ou desligar veículos, pontos de referência e fiscalização viária. Use a legenda para conferir o significado das cores dos marcadores.',
      'Use a barra à esquerda para buscar um veículo com GPS, importar um KML, medir distâncias ou desenhar uma área, círculo ou ponto temporário.',
      'Abra Veículos sem posição registrada para consultar as placas sem GPS válido. Clique em Atualizar painel para buscar novas posições e indicadores e confira o horário da consulta.',
      'No mapa da frota, use Acompanhar movimento para consultar novas posições a cada cinco segundos enquanto a tela estiver visível. O marcador desliza entre leituras recentes e próximas. O horário no marcador corresponde ao registro do GPS.',
      'Para calcular um caminho, use Traçar rota e consulte o tópico Rotas no mapa e envio ao motorista.',
    ],
    limites: ['O mapa mostra a última posição conhecida e indica quando ela deixou de ser recente. A frota inclui veículos próprios e espelhados autorizados. Veículos simulados aparecem separados dos reais.', 'Satélite e Trânsito aparecem quando o provedor está configurado. Os desenhos e o KML importado são temporários.'],
    empresa: { passos: ['Você pode começar com a frota vazia e cadastrar os veículos em Veículos quando estiver pronto.', 'Consulte as posições em Rastreamento e os eventos em Históricos.'], observacoes: ['Os cartões são calculados pelo banco; não há preenchimento manual.'] },
  },
  rotasMapa: {
    titulo: 'Rotas no mapa e envio ao motorista',
    objetivo: 'Traçar um caminho entre dois pontos, ajustar por onde o veículo deve passar e consultar a rota no celular.',
    uso: [
      'Em Mapa Geral, clique em Traçar rota. Marque a partida A com um clique ou use a última posição de um veículo. Clique no destino ou arraste o marcador B até ele.',
      'Para mudar partida ou destino, arraste o marcador. Você também pode selecionar Partida A ou Destino B e clicar no novo local.',
      'Para passar por um local específico, clique na linha ou arraste o sinal + até o local. Você pode ajustar os marcadores e adicionar até três passagens intermediárias.',
      'Use Ver rota recomendada para comparar o caminho pela estimativa de tempo e Voltar à rota personalizada para recuperar suas passagens. Use Limpar rota para recomeçar.',
      'No celular, entre com o perfil Motorista, abra Minhas rotas e selecione a rota recebida. Use Navegar até o destino para abrir o Google Maps com os pontos na ordem planejada.',
      'No detalhe da rota, use Ativar avisos para ver quando há fiscalização adiante. Use Ativar som se quiser ouvir um aviso e mantenha a página da Linktrac visível.',
    ],
    limites: ['O traçado fica temporário até a publicação. O cálculo pelas ruas depende da cobertura do roteador. Quando um ponto estiver distante das vias mapeadas, ajuste o ponto indicado na tela.', 'O roteador local cobre o Centro-Oeste, incluindo o DF, e estima o tempo sem trânsito em tempo real. O Google Maps calcula a navegação ao abrir a rota. O endereço da Linktrac precisa estar acessível no celular.'],
    empresa: { passos: [
      'Com permissão para configurar Entregas, escolha o veículo e o motorista. Se deixar o motorista em branco, será usado o vínculo ativo do veículo.',
      'Confira se o motorista tem conta ativa no perfil Motorista com o mesmo e-mail do cadastro de motorista e acesso ao módulo Entregas.',
      'Clique em Publicar para motorista. Use Rotas atribuídas para consultar ou cancelar uma publicação.',
    ] },
  },
  fiscalizacao: {
    titulo: 'Limites de velocidade, radares e barreiras',
    objetivo: 'Consultar limites mapeados e acompanhar alertas preventivos de velocidade da frota.',
    uso: [
      'Em Mapa Geral, abra Camadas do mapa e ligue Radares, barreiras e limites. Aproxime para ver os equipamentos e continue aproximando para ver os trechos de via com limite informado.',
      'Clique em um trecho ou radar para consultar a fonte e o limite disponível. Quando a fonte distinguir veículos leves e pesados, a tela mostra os dois valores.',
      'Em Central operacional, abra Notificações internas e confira avisos de fiscalização à frente e excessos no limite mapeado, com placa e horário. Após a análise, use Marcar como lida se seu perfil permitir.',
    ],
    limites: [
      'A cobertura depende dos dados disponíveis da ANTT, do DNIT e do OpenStreetMap. Parte dos radares tem localização sem limite informado. Siga a sinalização da via.',
      'Os alertas usam posições recentes do rastreador real. O aviso de aproximação exige que a pista e o sentido de fiscalização sejam identificados com os dados disponíveis. Quando a base tem limites distintos para leves e pesados, o aviso informa o maior deles. Consulte a sinalização para o seu veículo. Autos oficiais são acompanhados em Multas por veículo.',
    ],
  },
  multas: {
    titulo: 'Multas por veículo',
    objetivo: 'Acompanhar autos de infração registrados para a frota e seus prazos.',
    uso: [
      'Abra Central operacional e escolha Multas por veículo no seletor de área.',
      'Em Registros salvos, use Filtrar multas por veículo para consultar os autos de uma placa.',
      'Em Notificações internas, confira avisos de novo registro, prazo próximo e prazo vencido. Os lembretes são gerados para autos pendentes ou em recurso com prazo informado, a partir de sete dias antes do vencimento.',
    ],
    limites: ['O registro é manual. Use o link da tela para consultar os autos oficiais no serviço do governo. Os avisos são exibidos nas notificações da plataforma.'],
    empresa: { passos: [
      'Selecione um veículo da empresa, informe o número do auto, o órgão e a data da infração. Preencha o prazo para pagamento ou recurso e o valor quando constarem da notificação oficial.',
      'Salve o registro. Use Editar para corrigir os dados ou atualizar a situação para Pendente, Em recurso, Paga ou Cancelada.',
    ] },
  },
  revendedoras: {
    titulo: 'Revendedoras e carteira de clientes',
    objetivo: 'Administrar empresas revendedoras e os clientes atendidos por elas.',
    uso: [
      'Na conta principal da Linktrac, abra Clientes e escolha Nova revendedora. Informe os dados da empresa, o CPF ou CNPJ de acesso do administrador, o e-mail de contato e a senha inicial.',
      'Selecione os módulos contratados e salve. O administrador entra com o CPF ou CNPJ cadastrado e a senha.',
      'Na conta da revendedora, abra Clientes para ver Minha carteira de clientes. Use Novo cliente para cadastrar uma empresa e liberar os módulos que ela poderá consultar ou configurar.',
      'Na conta da revendedora, abra Identidade visual para definir o nome e o logotipo exibidos após o login. A mesma identidade aparece para os clientes da carteira.',
    ],
    limites: ['Cada revendedora administra sua própria carteira. Cada cliente acessa sua própria frota e os módulos liberados. A Linktrac controla os módulos contratados pela revendedora.'],
  },
  clientes: {
    titulo: 'Cadastro de clientes e permissões',
    objetivo: 'Cadastrar uma empresa cliente e definir o que sua equipe poderá consultar e configurar.',
    uso: [
      'Abra Clientes e clique em Novo cliente. Informe os dados da empresa, o CPF ou CNPJ de acesso, o e-mail de contato e a senha inicial do administrador.',
      'Em Acessos do cliente, escolha Sem acesso, Somente consulta ou Consultar e configurar em cada módulo, conforme as opções apresentadas.',
      'Confira as permissões antes de salvar. Para ajustar uma empresa existente, clique em Editar na linha do cliente e salve as alterações.',
    ],
    limites: ['As permissões dos módulos valem para toda a empresa. O perfil de cada usuário também determina quais ações ele pode executar.', 'A configuração inicial de um novo cliente permite consultar Rastreamento e Veículos. Cadastros anteriores mantêm seus acessos até que as permissões sejam alteradas.'],
  },
  integracoesCliente: {
    titulo: 'Chaves de API para sistemas de clientes',
    objetivo: 'Autorizar um sistema externo a acessar os dados de veículos da empresa cliente.',
    uso: [
      'Em Clientes, clique em Integrações na linha da empresa e informe um nome que identifique o sistema externo.',
      'Escolha as permissões da chave. As opções incluem listar veículos, consultar última posição e histórico ou atualizar marca, modelo, ano e cor, conforme os módulos liberados para a empresa.',
      'Gere a chave e copie-a quando aparecer. Envie a chave por canal seguro à equipe responsável pelo sistema. No servidor desse sistema, envie a chave no cabeçalho Authorization com o prefixo Bearer.',
      'Use Abrir documentação da API para consultar os endereços e exemplos. Para interromper o acesso, escolha Revogar na linha da chave.',
    ],
    limites: ['A chave é exibida uma vez e tem acesso somente aos veículos próprios da empresa. Para uso externo, a API precisa estar acessível por HTTPS. A instalação local atende testes no próprio computador.', 'As credenciais de rastreadores e gateways são geradas na Central operacional.'],
  },
  rastreamento: {
    titulo: 'Rastreamento', objetivo: 'Consultar a última posição, o trajeto, as viagens e as paradas de um veículo autorizado.',
    uso: ['Digite a placa e clique em Consultar. Se houver placas iguais, abra o veículo pela lista em Veículos.', 'Confira a última posição no mapa da própria tela e o horário em Registrado em. Ver posição no mapa abre também o ponto no OpenStreetMap.', 'Marque Atualizar a cada intervalo indicado para renovar a última posição. Desmarque para parar.', 'Em Histórico e trajeto, informe Início e Fim ou deixe em branco para consultar até 500 posições recentes. Clique em Consultar histórico.', 'Use Limpar período para voltar à consulta sem datas. Os horários dos filtros seguem o dispositivo que você está usando.', 'Abra Camadas do mapa para alternar trajeto, pontos e cercas virtuais ativas do veículo, quando existirem. Satélite e Trânsito aparecem quando há um provedor configurado.', 'Clique nos pontos para ver data, horário e velocidade. Verde indica início e vermelho indica fim.', 'Abra Replay do trajeto para reproduzir, pausar e avançar pelas posições registradas no mapa.', 'Alterne Viagens e Paradas para ver os trechos estimados, suas durações e os locais observados.'],
    limites: ['O histórico é atualizado pelo botão Consultar histórico, separadamente da última posição.', 'A linha do mapa liga pontos; não calcula o percurso pelas ruas. Distância e viagens são estimativas sem confirmação de ignição.', 'Lacunas acima de cinco minutos e posições sem dados suficientes não contam como movimento ou parada.', 'TESTE01 é uma simulação. Posições simuladas não descrevem o seu veículo real.'],
    empresa: { passos: ['Cadastre o veículo em Veículos antes de receber posições.', 'Verifique se as posições chegam e se a placa consultada corresponde ao cadastro correto.', 'Para integração de um rastreador real, solicite à administração a configuração compatível com o equipamento.'], observacoes: ['Cadastrar a placa não conecta o rastreador automaticamente.', 'Esta aba não oferece formulário para cadastrar posições reais ou alterar o rastreador.'] },
  },
  veiculos: {
    titulo: 'Veículos', objetivo: 'Listar os veículos próprios ou espelhados aos quais sua conta tem acesso.',
    uso: ['Localize o veículo na lista pela placa, marca e modelo.', 'Use o link de rastreamento da linha do veículo para consultar o cadastro correto, inclusive quando houver placas iguais.', 'Se não encontrar um veículo, confirme com sua empresa se ele foi cadastrado ou se o espelhamento foi autorizado.'],
    empresa: {
      passos: [
        'Preencha os campos obrigatórios ou clique em Editar veículo na linha de um veículo próprio para atualizar o cadastro.',
        'Em Ícone do veículo no mapa, escolha um ícone de carro, caminhão, trator, máquina ou outra categoria disponível.',
        'Para usar outro ícone, clique em Buscar ícone na internet, baixe uma imagem que você possa usar e selecione Adicionar imagem. São aceitos PNG, JPG e WebP de até 5 MB.',
        'Confira a placa e salve. O ícone aparece no mapa quando houver posição GPS registrada.',
        'Para marcar uma casa, empresa ou igreja, abra Pontos de referência e clique em Adicionar ponto de referência. Dê um nome, escolha o ícone, informe as coordenadas ou use Escolher ponto no mapa e clique em Salvar ponto.',
        'Use Ver no mapa, Editar ou Excluir na lista de pontos salvos. No Mapa Geral, controle a exibição pela camada Pontos de referência.',
      ],
      campos: [['Placa', 'Obrigatória. Informe a placa correta; o sistema salva em letras maiúsculas e remove espaços das extremidades. Não duplique o mesmo veículo na empresa.'], ['Marca', 'Obrigatória. Fabricante do veículo, como Fiat ou Volkswagen. Para testes fictícios usamos TESTE.'], ['Modelo', 'Obrigatório. Modelo do veículo. SIMULACAO é reservado por convenção aos nossos testes.'], ['Ano', 'Obrigatório. Ano inteiro entre 1886 e o próximo ano.'], ['Cor', 'Opcional. Cor predominante do veículo.'], ['Nome do cliente', 'Obrigatório. Nome para identificar o cliente associado ao cadastro. Não transfere o veículo a outra empresa.'], ['Telefone', 'Opcional. Contato relacionado ao veículo ou cliente.'], ['Ativo', 'Indica a situação cadastral. Não é um comando de bloqueio do veículo.']],
      observacoes: ['O cadastro pertence à empresa da conta conectada. Somente administradores e gestores podem cadastrar.', 'Um veículo espelhado continua pertencendo à empresa de origem. O cadastro não substitui a integração do rastreador.'],
    },
  },
  motoristas: {
    titulo: 'Motoristas', objetivo: 'Consultar os motoristas da sua empresa, com os cadastros salvos no banco.',
    uso: ['Use Buscar por nome e Filtrar situação, depois clique em Filtrar.', 'Leia nome, categoria, validade da CNH e situação na lista. A indicação Vencida destaca uma data anterior ao dia atual.', 'Use Anterior e Próxima para navegar entre páginas de até 20 cadastros. Limpar filtros volta à lista completa.', 'Atualizar lista consulta novamente o banco. Se ocorrer uma falha, a tela informa indisponibilidade em vez de afirmar que não há motoristas.'],
    limites: ['Cadastrar um motorista não cria uma conta de acesso ao sistema e não o vincula automaticamente a um veículo. Use Vínculos na Central operacional.', 'CPF, número da CNH, contatos, endereço e observações ficam restritos aos administradores e gestores da empresa.', 'A validação dos documentos é de formato; não há consulta oficial de CPF ou habilitação.'],
    empresa: { passos: ['Preencha Cadastrar motorista e clique no botão de cadastro. Os dados permanecem salvos ao sair da tela.', 'Para corrigir informações, clique em Editar na linha do motorista, altere os campos e use Salvar alterações. Cancelar edição mantém o cadastro sem alterações.', 'Para retirar um motorista da operação, edite a Situação para Inativo. Não é necessário apagar o cadastro.', 'Confira a confirmação antes de sair. Cadastros e alterações feitos pela tela são registrados em Ações dos usuários.'], campos: [['Nome completo', 'Obrigatório. Até 120 caracteres.'], ['CPF', 'Obrigatório. 11 dígitos; pontos e traço são aceitos e removidos ao salvar. Não pode se repetir na mesma empresa.'], ['Número da CNH', 'Obrigatório. 11 dígitos numéricos; não pode se repetir na mesma empresa.'], ['Validade da CNH', 'Obrigatória. Data válida; uma data vencida é permitida no cadastro e será destacada na lista.'], ['Categoria da CNH', 'Obrigatória. A, B, C, D, E, AB, AC, AD ou AE.'], ['Telefone', 'Opcional. Até 30 caracteres.'], ['E-mail', 'Opcional. Endereço de contato válido, com até 200 caracteres. Não cria um login.'], ['Endereço', 'Opcional. Até 300 caracteres.'], ['Situação', 'Ativo, Inativo ou Em férias. Pode ser alterada em Editar.'], ['Observações', 'Opcional. Até 1.000 caracteres.']], observacoes: ['Somente administradores e gestores podem incluir e editar. Operadores e motoristas consultam apenas os dados básicos.', 'A lista pertence à empresa conectada. O espelhamento de veículos não compartilha cadastros de motoristas.'] },
  },
  relatorios: {
    titulo: 'Relatórios', objetivo: 'Consultar dados recebidos e exportar as colunas escolhidas.',
    uso: ['Selecione veículo, início e fim, marque as colunas e clique em Gerar relatório.', 'Inclua leituras sem GPS para consultar sensores que não possuem localização.', 'Use Exportar CSV para baixar a consulta aplicada. Valores ausentes aparecem sem preenchimento.', 'Para obter a quilometragem e o KML do circuito, abra Quilometragem e trajeto GPS, selecione um veículo real, informe início e fim e clique em Calcular quilometragem. Confira a estimativa e baixe o KML com o trajeto observado.'],
    limites: ['Restrito à administração da empresa proprietária. Até 2.000 leituras por consulta e período máximo de 366 dias.', 'A exportação contém dados recebidos; não inventa combustível ou quilometragem.'],
    empresa: { passos: ['Cadastre o veículo e configure a integração na Central operacional.', 'Escolha apenas as colunas necessárias e confira o período antes de exportar.'], observacoes: ['O resumo financeiro fica na Central operacional e considera registros reais de abastecimento e manutenção.'] },
  },
  tms: {
    titulo: 'Roteirização de entregas e contêineres', objetivo: 'Selecionar as paradas do veículo, calcular o percurso e registrar o andamento.',
    uso: ['Abra Roteirização de entregas e selecione o veículo.', 'Use Abrir câmera ou Buscar código para localizar uma nota ou etiqueta cadastrada. Importe o XML da NF-e para aproveitar os dados de endereço de uma nota nova.', 'Confira os endereços e marque as entregas da rota. Informe a origem e a partida em Planejar rota e clique em Calcular rota.', 'No mapa, abra Camadas do mapa para alternar a linha do trajeto e os marcadores das paradas. Registre a chegada e conclua a entrega com o nome do recebedor, observação ou foto. Se não conseguir entregar, registre a tentativa e o motivo. Consulte as entregas encerradas em Histórico de entregas e comprovantes.'],
    limites: ['A câmera precisa de permissão e de acesso por HTTPS ou localhost. A leitura do código identifica a entrega cadastrada. O XML ou o endereço informado permite criar uma parada nova.', 'A tela indica quando o trajeto foi calculado por ruas e quando a ordem é estimada por coordenadas. A camada Trânsito é de visualização.'],
    empresa: { passos: ['Confira o destinatário, as coordenadas, a janela de atendimento e o tempo de serviço.', 'Para recolher cheios e deixar vazios no mesmo percurso, use Nova rota com trocas. Informe os movimentos e o descarregamento conforme a sequência das paradas. Na conclusão, confirme os movimentos realizados e consulte o saldo real ao lado do planejado no histórico.'], observacoes: ['A conclusão da entrega e as movimentações de contêiner são registradas na plataforma.'] },
  },
  resumoSemanal: {
    titulo: 'Resumo semanal da frota', objetivo: 'Revisar a operação dos últimos sete dias.',
    uso: ['Na Visão geral, clique em Resumo semanal.', 'Compare a ociosidade observada com a semana anterior e consulte alertas de risco, abastecimento e manutenção.', 'Clique em Atualizar resumo para renovar a consulta.'],
    limites: ['A ociosidade é estimada por intervalos curtos entre posições com ignição ligada e velocidade de até 3 km/h.'],
  },
  manutencaoInteligente: {
    titulo: 'Manutenção inteligente', objetivo: 'Consultar a análise dos sinais disponíveis para um veículo.',
    uso: ['Abra Manutenção inteligente e selecione um veículo da sua empresa.', 'Confira a análise e a data das leituras antes de avaliar a necessidade de uma revisão.'],
    limites: ['Os sinais disponíveis dependem da telemetria enviada pelo equipamento. DPF: recebe fuligem normalizada em %, luz, estado da regeneração e contagem de regenerações interrompidas. A classificação é indicativa e não prevê falha.', 'Configure as duas referências DPF do fabricante por veículo em Manutenção inteligente. Sem referências, o percentual não é interpretado como normal nem defeituoso; luz acesa e códigos relacionados podem recomendar inspeção. Leituras antigas são identificadas. Não há comando de regeneração forçada.'],
  },
  briefings: {
    titulo: 'Briefings e melhorias', objetivo: 'Organizar propostas recebidas nos briefings semanais.',
    uso: ['Abra Briefings e melhorias. Use Importar edições disponíveis para as nove edições de 28/09 a 23/11/2026 já incluídas na atualização, ou cole novo texto e clique em Importar e gerar propostas.', 'Textos em Markdown, tabelas e listas são aceitos. Filtre por situação, revise os itens e atualize o andamento de cada proposta. Reimportar a mesma edição não apaga a revisão existente.'],
    limites: ['A importação cria propostas para acompanhamento. As mudanças da plataforma dependem de implementação.'],
  },
  configuracoes: {
    titulo: 'Configurações', objetivo: 'Consultar e ajustar os limites operacionais da empresa.',
    uso: ['Confira os limites atuais. Somente administradores e gestores podem alterá-los.'],
    limites: ['As configurações são gravadas no banco e aplicadas às próximas avaliações.', 'Alterar limites não reprocessa notificações antigas nem envia mensagens externas.'],
    empresa: { passos: ['Ajuste velocidade, ausência de comunicação, temperatura, tensão e aceleração.', 'Confira os intervalos permitidos apresentados nos campos e clique em Salvar.', 'No rastreamento, reabra a tela para carregar o intervalo de atualização salvo.'], campos: [['Limite de velocidade', 'Limite em km/h para a avaliação de excesso.'], ['Ausência de comunicação', 'Minutos sem novas mensagens para indicar ausência.'], ['Temperaturas mínima e máxima', 'Faixa em graus Celsius; mínima deve ser menor que máxima.'], ['Tensão mínima', 'Valor em volts; exige leitura enviada pelo equipamento.'], ['Aceleração e combustível', 'Limiares para eventos e queda percentual; uma anomalia não comprova fraude.'], ['Atualização', 'Intervalo em segundos da consulta automática de posição.']], observacoes: ['As regras pertencem à empresa conectada. Não configuram o hardware remotamente.'] },
  },
  operacao: {
    titulo: 'Central operacional', objetivo: 'Gerenciar telemetria, entregas, manutenção, pneus e integrações.',
    uso: ['Esta área é restrita a administradores e gestores. As consultas comuns continuam em Rastreamento e Históricos.'],
    limites: ['Funções físicas dependem de equipamentos compatíveis. A aba Integrações apresenta o que ainda precisa de fornecedor ou homologação.'],
    empresa: { passos: ['Escolha a área no seletor e abra o manual específico do formulário.', 'Cadastre motoristas e veículos antes de criar vínculos, planos e entregas.', 'Em Cercas virtuais, informe o centro, o raio e o veículo. Confira a vigência e salve a cerca ativa. Entradas e saídas detectadas em novas posições aparecem em Notificações internas.', 'Consulte Notificações internas, confira a ocorrência e marque como lida após analisar.'], observacoes: ['Pneus usam movimentos cronológicos e odômetro informado. A indicação de inspeção depende desses registros.'] },
  },
  agro: {
    titulo: 'Agro, talhões e horímetro',
    objetivo: 'Delimitar talhões, estimar a área trabalhada e acompanhar revisões por horas do motor.',
    uso: [
      'Abra Operação → Agro e talhões. Escolha uma máquina para centralizar o mapa em sua última posição, se necessário.',
      'Clique em Novo talhão, dê um nome, clique no mapa em cada canto na ordem do contorno e salve. Use Editar talhão para corrigir o desenho.',
      'Selecione talhão e máquina, preencha o período da operação e a largura efetiva do implemento e clique em Calcular área.',
      'Em Central operacional → Manutenção preventiva, preencha o horímetro da última revisão e o intervalo em horas. Ao realizar a revisão, atualize a data e a leitura de referência no plano.',
    ],
    limites: [
      'A área é estimada pela faixa traçada por posições com ignição ligada e velocidade de trabalho. Passagens repetidas contam uma vez por célula da malha dentro do talhão.',
      'Use apenas o horário da operação. O GPS e a ignição não confirmam se o implemento estava acionado. Lacunas superiores a dois minutos ficam fora do cálculo.',
      'O lembrete por horas depende de o aparelho enviar o horímetro.',
    ],
  },
  monitoramento: {
    titulo: 'Central de monitoramento',
    objetivo: 'Atender ocorrências de perda de alimentação e movimento com ignição desligada.',
    uso: [
      'Abra Operação → Central de monitoramento. Alterne entre Abertas, Em atendimento e Encerradas.',
      'Clique em Abrir ficha para conferir a placa, o horário do alerta, o responsável e a última posição disponível do veículo.',
      'Com permissão para configurar Operação, clique em Assumir atendimento, siga o roteiro da ficha e use Registrar ação para guardar suas anotações.',
      'Informe o resultado e clique em Encerrar ocorrência. O histórico registra o responsável, a data e as ações.',
    ],
    limites: ['A fila atualiza a cada 10 segundos. O mapa da ficha mostra a última posição registrada, com seu horário.',
      'O movimento com ignição desligada exige três posições recentes do mesmo rastreador e pelo menos 60 metros de deslocamento confirmado. O rastreador precisa informar o estado da ignição.'],
    empresa: { passos: ['Para praticar, clique em Simular alerta, selecione o tipo e o veículo e crie a ocorrência de teste. A ocorrência fica marcada como simulação e não dispara WhatsApp.'] },
  },
  chips: {
    titulo: 'Chips, estoque e garantia',
    objetivo: 'Controlar chips de rastreadores e consultar os registros de vínculo e garantia.',
    uso: [
      'Abra Central operacional → Chips e estoque. Use Situação para ver chips em estoque, em uso ou inativos.',
      'Clique em Histórico na linha do chip para conferir data, usuário, origem e destino das movimentações.',
      'Em Equipamentos e credenciais, confira a data de garantia na ficha do equipamento.',
    ],
    empresa: { passos: [
      'Clique em Novo chip, informe o ICCID e a operadora e salve.',
      'Em Vincular, selecione um equipamento ativo da própria empresa. O veículo indicado é o do equipamento.',
      'Use Trocar equipamento para mover o chip ou Voltar ao estoque para remover o vínculo.',
      'Para registrar a validade da garantia, abra Equipamentos e credenciais → Editar e preencha Garantia até.',
    ], observacoes: ['O chip acompanha o equipamento em trocas de veículo na mesma empresa. Desativação, exclusão ou transferência do equipamento para outra empresa devolvem o chip ao estoque de origem.',
      'Desativar um chip na Linktrac altera sua situação no estoque. A linha continua sob gestão da operadora.'] },
  },
  cobranca: {
    titulo: 'Cadastro financeiro, contratos e prévia',
    objetivo: 'Preparar o pagador no Asaas, preencher o contrato e estimar a próxima cobrança.',
    uso: [
      'Em Clientes, abra Conta de cobrança e modelo. Selecione o ambiente e conecte a conta Asaas da própria empresa.',
      'Suba o modelo de contrato em Word (.docx). Inclua {cliente_nome}, {cliente_cpf_cnpj} e {lista_veiculos}. Os demais campos disponíveis aparecem na tela.',
      'No cadastro de um novo cliente, marque Preparar cadastro para cobrança e contrato. Se o cliente já existir, abra Financeiro e contrato e salve os dados do pagador.',
      'Na ficha do cliente, confira o vínculo do pagador, selecione os veículos e baixe o contrato preenchido. Revise e envie pelo canal habitual. Use Anexar contrato final para guardar o PDF.',
      'Na Prévia da cobrança mensal, informe o preço do rastreamento e dos adicionais por veículo. Use Simular cobrança para testar os valores e veículos adicionais. Use Salvar plano para gravar os preços.',
    ],
    limites: [
      'A prévia usa a frota ativa na data da consulta e exclui os veículos de simulação. Para revendedoras, inclui a frota própria e a dos clientes ativos da carteira.',
      'Os preços do plano valem para toda a frota contabilizada no contrato. A estimativa é atualizada a cada consulta.',
      'O vínculo com o Asaas prepara o pagador. Emissão de boletos, cobrança recorrente e conciliação de pagamentos ainda aguardam implementação.',
    ],
  },
  whatsapp: {
    titulo: 'Aviso de perda de alimentação pelo WhatsApp',
    objetivo: 'Identificar o número comercial usado para avisar os contatos autorizados.',
    uso: [
      'Com a conta administrativa da Linktrac, abra Configurações → WhatsApp Business.',
      'Digite o número comercial com DDD e clique em Salvar número. Confira se aparece Número confirmado na Meta.',
      'Em Veículos → Editar, informe o celular do contato com DDD e marque a autorização depois de o cliente aceitar os avisos.',
      'Em Central operacional → Notificações internas, acompanhe a situação do envio. Aceito pelo WhatsApp indica que a Meta aceitou o pedido de envio.',
    ],
    limites: ['O número pode ficar pendente até configurar a conta comercial e o modelo aprovado na Meta. A Central registra o alerta a partir da telemetria recebida.',
      'O rastreador precisa conseguir informar a perda de alimentação, inclusive quando o veículo estiver sem energia. A homologação depende de teste com o aparelho.'],
  },
  arquivoHistorico: {
    titulo: 'Arquivo de histórico',
    objetivo: 'Acompanhar a cópia de posições GPS e telemetria para um segundo banco.',
    uso: [
      'Com a conta administrativa da Linktrac, abra Central operacional → Arquivo de histórico.',
      'Confira a conexão, a última verificação, o registro mais antigo e o progresso da cópia.',
      'Em caso de indisponibilidade, consulte separadamente os últimos 30 dias para acessar o período recente.',
    ],
    limites: ['A política planejada é de 365 dias. A rotina atual copia e verifica o histórico e preserva os dados no banco de origem.',
      'O arquivo depende de um segundo banco configurado. Antes do uso em produção, é necessário validar a restauração de backup e a capacidade de cópia.'],
  },
  equipamentos: {
    titulo: 'Rastreadores, credenciais e histórico',
    objetivo: 'Cadastrar rastreadores, configurar o envio de dados e acompanhar alterações de vínculo.',
    uso: [
      'Em Cadastros → Rastreadores, consulte a última comunicação e os campos recebidos, como posição GPS, ignição e alimentação.',
        'Ao cadastrar ou editar rastreador ou câmera, abra Firmware e recursos do equipamento. Registre versão atual, versão disponível, última atualização, recursos da versão e falhas. São informações da equipe, com histórico de edição; salvar não envia firmware nem realiza OTA.',
      'No cadastro, abra Biblioteca de protocolos e modelos. Filtre por protocolo ou busque marca e modelo para ver as portas de referência e os manuais disponíveis.',
      'Use Histórico na linha do equipamento ou abra Histórico de equipamentos para consultar cadastros, edições, transferências, desativações e exclusões. Confira a data, o horário e as empresas e veículos envolvidos, quando informados.',
    ],
    limites: ['O histórico é preservado após a exclusão. A consulta por prefixo de IMEI pode sugerir fabricante e modelo. Confirme na etiqueta ou no manual do fabricante.', 'O recebimento exige um equipamento ou integrador configurado para o formato aceito pela Linktrac.'],
    empresa: { passos: [
      'Selecione o veículo, informe o IMEI ou código externo e confira fabricante e modelo no catálogo. Se o modelo estiver ausente, preencha manualmente.',
      'Para o receptor da Linktrac, marque Usar o receptor da Linktrac para este rastreador. Selecione o protocolo de recepção e um veículo real. Informe o IMEI ou identificador exigido pelo protocolo. O cadastro é sincronizado em até 30 segundos quando a integração do servidor está ativa.',
      'Configure no aparelho o IP, a APN do chip e a porta mostrados no cadastro. A lista Protocolo de recepção mostra os protocolos habilitados no servidor e seus transportes TCP ou UDP. Confirme a variante e o firmware no manual e valide o recebimento de uma posição real. Câmeras podem exigir uma integração adicional para transmitir vídeo.',
      'Para envio individual via API, copie a credencial ao gerar e configure o integrador com os cabeçalhos x-device-id e x-device-token.',
      'Para encaminhamento JSON do Traccar, confira o identificador externo do equipamento e crie o gateway em Gateways de protocolos. Configure o encaminhamento com x-gateway-id e x-gateway-token. Consulte a documentação em Integrações e disponibilidade.',
      'Use Editar para atualizar os dados ou o vínculo. Ao transferir para outro cliente, atualize o integrador de destino com a nova credencial, pois a anterior deixa de funcionar.',
    ] },
  },
  videotelemetria: {
    titulo: 'Videotelemetria',
    objetivo: 'Consultar eventos de vídeo e os clipes recebidos de câmeras ou gravadores integrados.',
    uso: [
      'Em Central operacional, abra Videotelemetria. Filtre por veículo e confira horário, equipamento, canal e tipo de evento.',
      'Abra Catálogo e configurações de câmeras para consultar os parâmetros e os manuais disponíveis por marca e modelo.',
      'Use Abrir clipe quando o fornecedor enviar um link válido. Eventos sem link ou com link expirado permanecem na lista.',
    ],
    limites: ['A disponibilidade dos eventos e dos clipes depende do equipamento e do integrador. A tela exibe eventos recebidos e links de clipes.'],
    empresa: { passos: [
      'Em Cadastros → Câmeras, cadastre a câmera ou o gravador e associe ao veículo.',
      'Configure o fornecedor ou integrador para enviar os eventos e links dos clipes conforme a documentação da API em Integrações e disponibilidade.',
    ] },
  },
  usuarios: {
    titulo: 'Usuários', objetivo: 'Consultar os acessos da equipe quando seu perfil permitir.',
    uso: ['Esta aba é restrita aos administradores e gestores. Para obter ou corrigir seu acesso, procure a administração da sua empresa.', 'Use Sair para encerrar sua sessão neste navegador.'],
    empresa: { passos: ['Abra Usuários com uma conta de administrador ou gestor.', 'Confira a empresa indicada na tela, preencha o formulário e clique em Criar usuário.', 'Aguarde a confirmação e confira a nova conta na lista. Novos membros da equipe não devem usar o cadastro inicial de empresa.'], campos: [['Nome', 'Obrigatório. Nome de identificação da pessoa.'], ['CPF ou CNPJ para entrar', 'Obrigatório para novas contas. Use um documento diferente para cada conta.'], ['E-mail de contato', 'Obrigatório e único. Para motoristas, informe o mesmo e-mail do cadastro operacional.'], ['Senha', 'Obrigatória. Pelo menos seis caracteres neste formulário. Não é a senha do MongoDB.'], ['Papel', 'Administrador ou gestor pode administrar usuários e cadastrar veículos e serviços; operador e motorista usam as consultas autorizadas. Escolha apenas o acesso necessário.']], observacoes: ['As contas criadas pertencem à empresa da sessão atual.', 'A tela atual permite criar e listar usuários, mas não oferece edição de conta nem redefinição de senha. Solicite a recuperação à administração.'] },
  },
  espelhamentos: {
    titulo: 'Espelhamentos', objetivo: 'Entender o acesso de consulta a veículos de outra empresa.',
    uso: ['A autorização é administrada exclusivamente pela Linktrac.', 'Quando autorizado, o veículo aparece em Veículos e pode ser consultado em Rastreamento e Históricos.', 'O espelhamento não transfere a propriedade nem concede acesso à manutenção da proprietária.'],
    empresa: { passos: ['Selecione Veículo de origem, conferindo a placa e a proprietária.', 'Selecione Empresa que receberá acesso e clique em Autorizar espelhamento.', 'Confira o vínculo na lista. Para encerrar a consulta compartilhada, use Revogar acesso no vínculo desejado.'], campos: [['Veículo de origem', 'Veículo original cujo acesso será compartilhado. Confira a proprietária, especialmente se houver placas iguais.'], ['Empresa que receberá acesso', 'Empresa cadastrada que poderá consultar posições e histórico. A proprietária e empresas já autorizadas não aparecem como novas opções.']], observacoes: ['A revogação bloqueia as próximas consultas da empresa de destino. Não apaga o veículo nem as posições.', 'Esta operação não configura envio entre plataformas externas, como a Intertrack.'] },
  },
  'historicos.alertas': {
    titulo: 'Histórico de alertas', objetivo: 'Consultar ocorrências calculadas pelas posições recentes do veículo.',
    uso: ['Selecione o veículo no campo Veículo.', 'Leia data, tipo do alerta, detalhe e origem na tabela. Simulado indica dados fictícios.', 'Clique em Atualizar histórico para consultar novamente. Use o link de posições para abrir o mapa e o trajeto.'],
    limites: ['Exibe até 500 posições recentes. Alertas são calculados ao consultar; não enviam notificações.', 'Velocidade acima de 80 km/h gera ocorrência. Intervalos acima de cinco minutos indicam ausência de comunicação; também podem representar equipamento desligado ou simulação encerrada.'],
    empresa: { passos: ['Cadastre o veículo em Veículos e confira a chegada das posições em Rastreamento.', 'Abra Históricos, escolha Alertas e selecione o veículo.'], observacoes: ['Não há cadastro manual de alerta nesta aba.', 'A administração pode ajustar os limites em Configurações.'] },
  },
  'historicos.ignicao': {
    titulo: 'Histórico de ignição', objetivo: 'Consultar estados de ignição recebidos, sem deduzi-los pela velocidade.',
    uso: ['Selecione o veículo e abra Ignição.', 'Leia Ligada ou Desligada, o horário e a origem.', 'Estado observado significa uma leitura disponível; Mudança observada significa diferença entre leituras próximas.', 'Clique em Atualizar histórico para renovar a consulta.'],
    limites: ['Só aparecem registros que receberam informação de ignição. Velocidade zero não significa ignição desligada.', 'Após lacunas, o horário exato da mudança não é conhecido. Não há preenchimento retroativo.', 'O TESTE01 recebe ignição simulada. Isso não confirma a ignição do seu veículo real.'],
    empresa: { passos: ['Confirme com a administração que a integração do equipamento envia a informação de ignição.', 'Consulte o veículo e confira se a origem está identificada corretamente.'], observacoes: ['Não há formulário para cadastrar ignição nesta tela. As informações chegam pelas posições do equipamento ou do simulador de teste.'] },
  },
  'historicos.manutencoes': manutencao,
  'historicos.acoes': {
    titulo: 'Histórico de ações dos usuários', objetivo: 'Consultar operações registradas para sua empresa.',
    uso: ['Esta consulta é restrita aos administradores e gestores. Usuários comuns devem solicitar informações à sua empresa.'],
    empresa: { passos: ['Abra Históricos e escolha Ações dos usuários.', 'Confira data, pessoa, operação e área para identificar logins, cadastros e alterações.', 'Clique em Atualizar histórico para buscar novas operações.'], observacoes: ['São mostradas até 500 operações bem-sucedidas registradas a partir da ativação da auditoria.', 'Não aparecem consultas, tentativas de login recusadas, scripts locais ou mudanças feitas diretamente no banco.', 'Senhas, tokens e os valores completos dos formulários não são exibidos. Esta lista não permite alterar nem excluir os registros.'] },
  },
  login: {
    titulo: 'Entrar', objetivo: 'Acessar a plataforma com sua conta da empresa.',
    uso: ['Informe o CPF ou CNPJ cadastrado e a senha. Se sua conta antiga usa e-mail, informe o e-mail no mesmo campo. Clique em Entrar.', 'A senha da plataforma é diferente da senha do banco ou de outras plataformas de rastreamento.', 'Se não lembrar a senha ou seu acesso for recusado, solicite recuperação à administração da empresa. Não envie sua senha por mensagem.', 'Se houver indisponibilidade temporária ao restaurar a sessão, use Tentar novamente quando essa opção aparecer.'],
  },
  registro: {
    titulo: 'Cadastro inicial', objetivo: 'Entender a diferença entre o cadastro de uma empresa e uma conta da equipe.',
    uso: ['Se sua empresa já está configurada, abra Entrar e use a conta fornecida pela administração.', 'Para um novo acesso de usuário, procure a administração da sua empresa.', 'A mensagem Registro não está disponível após a configuração inicial significa que esta tela não pode criar outra conta nessa condição.'],
    empresa: { passos: ['O cadastro inicial depende da liberação da administração. Não use este formulário para adicionar membros da equipe.', 'Após a configuração inicial, crie as contas da equipe em Usuários.'], campos: [['Nome da empresa', 'Nome da empresa que será cadastrada.'], ['Identificador (slug)', 'Identificador único da empresa.'], ['CNPJ', 'Documento informado para a empresa.'], ['Nome e e-mail', 'Identificação e contato do primeiro administrador.'], ['CPF ou CNPJ para entrar', 'Documento usado para acessar a conta com a senha.'], ['Senha', 'Senha de acesso à plataforma. Não use a senha do banco.'], ['Código de registro', 'Somente quando fornecido pela administração para liberar o cadastro.']], observacoes: ['A disponibilidade depende da configuração da instalação. Não compartilhe códigos de registro.'] },
  },
};
export const secaoPorRota = {
  '/': 'painel', '/dashboard': 'painel', '/mapa': 'painel', '/minhas-rotas': 'rotasMapa', '/rastreamento': 'rastreamento', '/veiculos': 'veiculos',
  '/pessoas': 'familia', '/pessoas/aparelho': 'familia', '/pessoas/verificacoes': 'familia', '/jornada': 'jornada', '/tags-ble': 'tagsBle', '/operacao': 'operacao', '/rastreadores': 'equipamentos', '/cameras': 'videotelemetria', '/motoristas': 'motoristas', '/relatorios': 'relatorios', '/tms': 'tms', '/configuracoes': 'configuracoes',
  '/monitoramento': 'monitoramento', '/agro': 'agro',
  '/usuarios': 'usuarios', '/espelhamentos': 'espelhamentos', '/login': 'login', '/register': 'registro',
};
const moduloDeCadastro = {
  veiculos: 'veiculos', rotasMapa: 'entregas', multas: 'operacao', monitoramento: 'operacao',
  familia: 'familia', jornada: 'operacao', tagsBle: 'equipamentos', chips: 'equipamentos', equipamentos: 'equipamentos', videotelemetria: 'equipamentos',
};

export const podeVerCadastro = (user, secao) => Boolean(user && ['admin', 'gestor'].includes(user.role) &&
  (secao !== 'espelhamentos' || user.podeGerenciarEspelhamentos) &&
  (!moduloDeCadastro[secao] || permite(user, moduloDeCadastro[secao], true)));
