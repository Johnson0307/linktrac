const teltonikaGPS = [
  ['Rede móvel', 'No Teltonika Configurator, abra GPRS e informe a APN, o usuário e a senha fornecidos pela operadora.'],
  ['Servidor', 'Em GPRS, preencha domínio ou IP, porta e protocolo TCP ou UDP conforme o gateway de rastreamento.'],
  ['Frequência de envio', 'Em Data Acquisition, ajuste a coleta e o envio de posições com o veículo parado ou em movimento.'],
  ['Gravar e conferir', 'Salve no aparelho pelo Configurator e confira o estado de GSM e GNSS. O manual também descreve a configuração inicial por SMS.'],
];

const imperioMini = 'https://imperiodosrastreadores.com.br/wp-content/uploads/2025/09/LV-12-4G-USB-MINI-2025.pdf';
const imperioTermo = 'https://imperiodosrastreadores.com.br/wp-content/uploads/2025/09/lv-12-4g-Termo-Retratil-25-26-IMPERIO-DOS-RASTREADORES.pdf';
const suntech8300 = 'https://www.suntechdobrasil.com.br/public/media/arquivos/1764180655-manual_do_usuario_st4305_st8300_st8300r_rev24.pdf';
const suntech8310 = 'https://www.suntechdobrasil.com.br/public/media/arquivos/1758894855-manual_do_usuario_linha_st8310u-w-r_rev4.pdf';
const suporteSuntech = 'https://www.suntechdobrasil.com.br/suporte';
const rstMini4g = 'https://cache.1gps.com.br/rastreadores/rst-mini-4g/manuais-pdf/manual_do_usuario_rst_mini_4g_pt.pdf';
const rstMiniLc = 'https://cache.1gps.com.br/rastreadores/rst-mini-lc-4g/manuais-pdf/manual_do_usuario_rst_mini-lc-4g_pt.pdf';
const rstHibrido = 'https://cache.1gps.com.br/rastreadores/rst-hibrido/manuais-pdf/especificacoes_tecnicas_rst_hibrido_pt.pdf';
const rstObd = 'https://cache.1gps.com.br/rastreadores/rst-obd-ll/rst-obd-ll_2g/manuais-pdf/especificacoes_tecnicas_rst_obdii_pt.pdf';
const jimiTeste = 'https://iothub.jimiiot.com/test/test.html#_2-1-device-connection';
const jimiIntegracao = 'https://iothub.jimiiot.com/overview/getting-started.html';
const howen = 'https://www.howentech.com/mdvr';

const parametrosSuntech = [
  ['Rede e servidor', 'Abra Parâmetros de rede no SyncTrak. Configure os dados do chip e o servidor indicado pela Linktrac para o protocolo do aparelho.'],
  ['Envio de posições', 'Confira os intervalos para ignição ligada e desligada e os relatórios habilitados no manual da revisão.'],
  ['Diagnóstico', 'Leia de volta a configuração e verifique a chegada de uma posição ao gateway antes de entregar o aparelho.'],
];

const redeRst = ['Rede e servidor', 'Confirme a revisão do RST, a configuração do chip e o modo de comunicação com o suporte MultiPortal. Use o IP e a porta definidos para o gateway em operação.'];

const lv12 = {
  parametros: [
    ['Identificação', 'Confirme o nome completo do modelo e a revisão do aparelho na etiqueta ou com o fornecedor. A linha LV-12 inclui variantes com manuais próprios.'],
    ['Rede móvel', 'Separe a APN e, quando exigidos, o usuário e a senha do chip M2M. Use os valores fornecidos pela operadora do chip.'],
    ['Servidor e transmissão', 'Separe o IP ou domínio e a porta do gateway compatível. Confirme no manual da variante como ajustar o servidor e os intervalos com a ignição ligada e desligada.'],
  ],
  fontes: [
    ['Império dos Rastreadores — manual USB Mini', imperioMini],
    ['Império dos Rastreadores — manual Termo Retrátil', imperioTermo],
  ],
};

const jimiJtt = [
  ['Rede móvel', 'Confirme se o SIM está ativo e se a câmera está conectada à rede. Confira o cartão de memória quando houver gravação local.'],
  ['Servidor', 'Use o IP e a porta do gateway compatível com JT/T 808/1078. A documentação da Jimi mostra a sintaxe SMS específica de cada modelo e os passos de teste do IoTHub.'],
  ['Vídeo', 'O recebimento de clipes na Linktrac depende de um integrador que encaminhe o evento e o link de mídia.'],
];

const jimiProprietario = [
  ['Rede e servidor', 'Confirme os dados do SIM e os parâmetros de conexão com o integrador do protocolo JIMI. Use o guia do IoTHub para identificar o serviço compatível.'],
  ['Vídeo', 'Confirme com o fornecedor os modos de captura, envio de arquivos e eventos disponíveis no firmware da câmera.'],
];

export default [
  { fabricante: 'Suntech', modelos: ['ST4305', 'ST8300', 'ST8300R', 'ST8300H'], parametros: parametrosSuntech,
    fontes: [['Suntech — manual ST4305 e linha ST8300', suntech8300], ['Suntech — suporte técnico', suporteSuntech]] },
  { fabricante: 'Suntech', modelos: ['ST8310', 'ST8310U', 'ST8310W', 'ST8310R'], parametros: parametrosSuntech,
    fontes: [['Suntech — manual ST8310U, W e R', suntech8310], ['Suntech — suporte técnico', suporteSuntech]] },
  { fabricante: 'Suntech', modelos: ['ST8310UM'], parametros: parametrosSuntech,
    fontes: [['Suntech — formação e suporte para ST8310UM', 'https://universt.suntechdobrasil.com.br/collections']] },
  {
    fabricante: 'MultiPortal', modelos: ['RST MINI 4G'], termos: 'pulso rede CAN red CAN telemetria horímetro hodômetro',
    parametros: [
      redeRst,
      ['Pulso e rede CAN', 'Identifique o modo de cada entrada no configurador e no manual da revisão. Confira em bancada o envio das leituras de pulso e CAN. O recebimento depende do firmware, da configuração e dos campos encaminhados pelo gateway.'],
    ],
    fontes: [['MultiPortal — manual do RST Mini 4G', rstMini4g]],
  },
  { fabricante: 'MultiPortal', modelos: ['RST MINI LOW COST'], parametros: [redeRst],
    fontes: [['MultiPortal — manual do RST Mini LC', rstMiniLc]] },
  {
    fabricante: 'MultiPortal', modelos: ['RST HIBRIDO'], termos: 'pulso rede CAN red CAN telemetria híbrido 4G',
    parametros: [redeRst, ['Sensor de pulso e rede CAN', 'A ficha do RST Híbrido 4G lista os dois recursos. Confirme a configuração e os dados encaminhados antes de usar em operação.']],
    fontes: [['MultiPortal — ficha técnica do RST Híbrido 4G', rstHibrido]],
  },
  {
    fabricante: 'MultiPortal', modelos: ['RST OBD2'], termos: 'rede CAN red CAN telemetria OBD II OBDII',
    parametros: [redeRst, ['Rede CAN', 'A ficha técnica indica leitura da rede CAN pelo OBD II. Confira a compatibilidade com o veículo e os campos que o gateway recebe.']],
    fontes: [['MultiPortal — ficha técnica do RST OBD II', rstObd]],
  },
  {
    fabricante: 'Império dos Rastreadores', modelos: ['LV12 4G USB Interno'],
    parametros: [lv12.parametros[0], lv12.parametros[1], ['Servidor', 'A ficha desta variante indica configuração por SMS ou USB. Consulte o suporte da Império para obter o protocolo e os parâmetros próprios do firmware.']],
    fontes: [['Império dos Rastreadores — LV-12 4G USB Interno', 'https://imperiodosrastreadores.com.br/lv-12-4g-2g-usb-interno/']],
  },
  { fabricante: 'Império dos Rastreadores', modelos: ['LV12 4G', 'LV12 4G SA'], ...lv12 },
  {
    fabricante: 'Império dos Rastreadores', modelos: ['LV12 4G USB Mini'],
    parametros: [
      ['Rede móvel', 'Configure por SMS com os dados da operadora. Substitua os campos do exemplo pelos valores do chip.', 'APN,<APN>,<USUÁRIO>,<SENHA>#'],
      ['Servidor', 'O manual mostra opções para domínio ou IP. Para domínio, substitua os campos pelo endereço e pela porta do gateway de rastreamento.', 'SERVER,1,<DOMÍNIO>,<PORTA>,1#'],
      ['Transmissão', 'Ajuste o intervalo por estado da ignição e a frequência de comunicação GSM de acordo com a operação.'],
      ['Diagnóstico', 'O manual indica WHERE# para consultar a localização por SMS.'],
    ],
    fontes: [['Império dos Rastreadores — manual USB Mini', imperioMini]],
  },
  {
    fabricante: 'Império dos Rastreadores', modelos: ['LV12 4G Termo Retrátil'],
    parametros: [
      ['Rede e servidor', 'Use os dados da operadora do SIM e os valores do gateway de rastreamento. Consulte no manual os comandos próprios desta revisão.'],
      ['Transmissão e ignição', 'O manual descreve os intervalos de transmissão, comunicação GSM, modo de economia e seleção de ignição física ou virtual.'],
      ['Diagnóstico', 'O manual indica WHERE# para consultar a localização por SMS.'],
    ],
    fontes: [['Império dos Rastreadores — manual Termo Retrátil', imperioTermo]],
  },
  ...['FMB920', 'FMC920', 'FMC130'].map(modelo => ({
    fabricante: 'Teltonika', modelos: [modelo], parametros: teltonikaGPS,
    fontes: [[`Teltonika — configuração inicial do ${modelo}`, `https://wiki.teltonika-gps.com/view/${modelo}_First_Start`]],
  })),
  {
    fabricante: 'Queclink', modelos: ['GV300'],
    parametros: [
      ['Rede e servidor', 'O fabricante lista transmissão por TCP, UDP e SMS. Confirme APN, servidor, porta e modo de transmissão com a operadora e o integrador.'],
      ['Entradas e acessórios', 'Consulte o manual da revisão para ajustar detecção de ignição e acessórios RS232, quando instalados.'],
    ],
    fontes: [['Queclink — ficha do GV300', 'https://www.queclink.com/product-detail/gv300']],
  },
  {
    fabricante: 'Jimi IoT', modelos: ['JC181', 'JC450'],
    parametros: jimiJtt,
    fontes: [['Jimi IoT — configuração e teste do gateway', jimiTeste]],
  },
  {
    fabricante: 'Jimi IoT', modelos: ['JC371'],
    parametros: [jimiJtt[0], ['Servidor', 'O fabricante lista o JC371 entre os modelos da família JT/T 808/1078. Confirme com o fornecedor a configuração de servidor para sua versão.'], jimiJtt[2]],
    fontes: [['Jimi IoT — protocolos e modelos', jimiIntegracao]],
  },
  {
    fabricante: 'Jimi IoT', modelos: ['JC261', 'JC400'],
    parametros: jimiProprietario,
    fontes: [['Jimi IoT — protocolos e modelos', jimiIntegracao]],
  },
  ...['DashCam', 'DualCam'].map(modelo => ({
    fabricante: 'Teltonika', modelos: [modelo],
    parametros: [
      ['Conexão', `No rastreador compatível, configure o modo ${modelo} em RS232/RS485 e confira a versão de firmware indicada no manual.`],
      ['Servidor de mídia', 'Preencha o domínio e a porta do servidor de vídeo na seção da câmera. Confirme com o integrador o protocolo de mídia.'],
      ['Captura', 'Consulte os parâmetros de foto e vídeo por evento disponíveis para o rastreador e o firmware instalados.'],
    ],
    fontes: [[`Teltonika — configuração da ${modelo}`, `https://wiki.teltonika-gps.com/view/${modelo}_Configuration`]],
  })),
  ...[
    ['Hero-ME30-04', '4 entradas AHD e gravação em HDD/SSD ou cartão SD.'],
    ['Hero-ME31-08 V5', '8 entradas de vídeo de 1080p, cartão SD e HDD/SSD. Os recursos de assistência à condução dependem dos acessórios.'],
    ['Hero-ME32-04', '4 entradas AHD e 1 IP, cartão SD e HDD/SSD. A detecção por câmera é opcional.'],
    ['Hero-ME40-04', '4 entradas de vídeo de 1080p e gravação em cartão SD. O Wi-Fi depende de adaptador.'],
    ['Hero-ME41-02', '2 entradas de vídeo de 1080p e gravação em cartão SD. O Wi-Fi depende de adaptador.'],
    ['Hero-ME41-04', '4 entradas AHD e 1 IP, com 2 cartões SD. A detecção por câmera é opcional.'],
  ].map(([modelo, video]) => ({
    fabricante: 'Howen', modelos: [modelo],
    parametros: [
      ['Gravação', video],
      ['Rede e plataforma', 'Consulte o integrador Howen sobre os parâmetros do SIM e o servidor de vídeo para o firmware instalado. A ficha pública descreve os recursos de rede e armazenamento por modelo.'],
    ],
    fontes: [['Howen — fichas dos gravadores veiculares', howen]],
  })),
  {
    fabricante: 'Hikvision', modelos: ['AE-MD5043-SD'],
    parametros: [
      ['Rede móvel', 'Em Configuration → Network → Basic Settings → 3G/4G, habilite a conexão celular. Para APN privada, preencha APN, usuário, senha e número de acesso se exigido.'],
      ['Prioridade de rede', 'Confira a prioridade entre rede celular, Wi-Fi e LAN nas opções do firmware.'],
      ['Diagnóstico', 'Use Wireless Dial-up Status para verificar SIM, intensidade do sinal, registro na rede e endereço IP.'],
    ],
    fontes: [['Hikvision — guia de configuração do AE-MD5043-SD', 'https://assets.hikvision.com/prd/normal/all/doc/m000057729/Baseline_AE-MD5043-SD_Mobile-DVR_User-Manual__V5.1.1_20230505.pdf']],
  },
];
