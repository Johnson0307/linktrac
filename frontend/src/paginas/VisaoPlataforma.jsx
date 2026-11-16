import { Link } from 'react-router-dom';
import AcoesDaPagina from '../componentes/layout/AcoesDaPagina';
import './VisaoPlataforma.css';

const modulos = [
  {
    titulo: 'Mapa e rastreamento',
    funcoes: [
      ['Visão geral', 'Mapa da frota com última posição conhecida, veículos em movimento, veículos que precisam de atenção e serviços registrados.'],
      ['Mapa geral', 'Tela cheia, zoom pela rodinha, busca por veículo, ícones personalizados, pontos de referência, medição de distâncias, desenhos temporários e importação de KML. Satélite e trânsito dependem da configuração do provedor.'],
      ['Rastreamento por veículo', 'Data e hora da posição, velocidade, histórico no mapa, viagens e paradas estimadas.'],
      ['Replay do trajeto', 'Reprodução das posições registradas com pausa, avanço ou recuo por ponto, barra de posição, velocidade ajustável e indicação de lacunas.'],
      ['Acompanhar movimento', 'Atualização automática no mapa da frota com movimento suavizado entre posições recentes recebidas do GPS.'],
      ['Cercas virtuais', 'Áreas por veículo com avisos de entrada e saída quando chegam novas posições.'],
      ['Radares, barreiras e limites', 'Exibe a fiscalização no mapa e alerta sobre excesso no limite mapeado. Quando a via e o sentido são confirmados, o motorista pode receber um aviso visual e sonoro de aproximação em Minhas rotas, com a tela aberta.'],
      ['Multas por veículo', 'Registro manual de autos, órgão, valor, situação e lembretes internos de prazo.'],
    ],
  },
  {
    titulo: 'Central de monitoramento e alertas',
    funcoes: [
      ['Fila de ocorrências', 'Ocorrências abertas, em atendimento e encerradas. Atualização a cada 10 segundos, prioridade e identificação das simulações.'],
      ['Ficha de atendimento', 'Placa, última posição conhecida, roteiro, operador responsável, anotações e encerramento com desfecho registrado.'],
      ['Perda de alimentação', 'Abre uma ocorrência quando o rastreador informa o corte. O WhatsApp Business pode avisar o contato autorizado do veículo após configurar a Meta.'],
      ['Movimento com a ignição desligada', 'Abre uma ocorrência após três leituras recentes do mesmo rastreador que confirmem o deslocamento com ignição desligada.'],
      ['Notificações internas', 'Cercas, velocidade, bateria, falhas de comunicação, manutenção, telemetria e prazos de multas. E-mail e webhooks são opcionais para eventos selecionados.'],
    ],
  },
  {
    titulo: 'Rotas, entregas e contêineres',
    funcoes: [
      ['Rotas editáveis', 'Marque partida e destino, arraste os pontos ou a linha para incluir até três passagens e compare com a rota recomendada.'],
      ['Rotas atribuídas', 'O gestor publica ou cancela uma rota para um veículo e motorista. Pelo celular, o motorista consulta a rota e pode abrir a navegação no Google Maps.'],
      ['Roteirização de entregas', 'Cadastro de paradas, importação de XML da NF-e e leitura de QR Code, código de barras ou etiqueta para localizar entregas cadastradas.'],
      ['Acompanhamento de entregas', 'Janelas de atendimento, chegada, conclusão, tentativa e comprovante com recebedor, observação ou foto.'],
      ['Operação de contêineres', 'Retirada de cheios, entrega de vazios, descarregamento, movimentações por parada e comparação do saldo planejado com o realizado.'],
    ],
  },
  {
    titulo: 'Frota, equipamentos e relatórios',
    funcoes: [
      ['Veículos e motoristas', 'Cadastro, edição, vínculos por período, validade da CNH e escolha do ícone do veículo no mapa.'],
      ['Rastreadores, câmeras e gravadores', 'Catálogo por marca e modelo, guias de configuração disponíveis, sugestão por IMEI, credenciais, última comunicação e histórico de transferências, desativações e exclusões.'],
      ['Chips e estoque', 'Cadastro por ICCID e operadora, situação, vínculo com equipamento e veículo e histórico de movimentações. A validade da garantia é registrada no equipamento.'],
      ['Telemetria', 'Leituras com ou sem GPS, ignição, temperatura, tensão, aceleração, combustível, odômetro e códigos de falha, conforme o equipamento.'],
      ['Videotelemetria', 'Eventos e links de clipes recebidos por integração, incluindo fadiga, distração, uso de celular e colisão quando enviados pelo fornecedor.'],
      ['Manutenção', 'Histórico de serviços e custos, planos por prazo ou quilometragem e análise dos sinais disponíveis para sugerir inspeções.'],
      ['Agro e talhões', 'Desenho do talhão no mapa, estimativa de hectares trabalhados por máquina e período e revisão preventiva por horímetro quando recebido.'],
      ['Pneus e abastecimentos', 'Montagem, rodízio, inspeção e recapagem de pneus. Registro de volumes, custos e divergências de abastecimento.'],
      ['Relatórios', 'Filtros, colunas personalizadas, exportação CSV, quilometragem estimada e trajeto GPS em KML. Inclui resumo semanal, ociosidade, comportamento de condução, custos e conferência de combustível.'],
      ['Históricos e alertas', 'Ignição, ocorrências, manutenção e ações dos usuários. Limites operacionais configuráveis e envio opcional por e-mail ou webhook para eventos compatíveis.'],
      ['Arquivo de histórico', 'Consulta ao banco de arquivo quando configurado e painel de saúde da cópia. A política planejada é de 365 dias, com 30 dias de acesso recente. A fase atual preserva os registros no banco principal.'],
    ],
  },
  {
    titulo: 'Financeiro e contratos',
    funcoes: [
      ['Cadastro de pagadores', 'Cada empresa pode conectar sua conta Asaas para cadastrar ou localizar os pagadores da própria carteira.'],
      ['Contratos de prestação de serviço', 'Upload de modelo Word, preenchimento com os dados do cliente e veículos selecionados e anexo do contrato final em PDF. O envio é feito pela equipe.'],
      ['Prévia da cobrança mensal', 'Valores por veículo e função, totais estimados por cliente ou carteira de revenda e simulação de veículos adicionais antes de salvar o plano.'],
    ],
  },
  {
    titulo: 'Administração, revenda e integrações',
    funcoes: [
      ['Administração Linktrac, revendedoras e clientes', 'A Linktrac libera os módulos contratados. Cada revendedora administra a própria carteira e distribui acessos dentro do contrato.'],
      ['Perfis e login', 'Contas de administradores, gestores, operadores e motoristas, com permissões por perfil e módulo. Novas contas entram com CPF ou CNPJ e senha. Contas antigas usam o e-mail cadastrado.'],
      ['Identidade visual', 'Nome e logotipo da Linktrac e das revendedoras. Após o login, os clientes da carteira veem a marca da revendedora.'],
      ['Espelhamento', 'Consulta autorizada a veículos de outra empresa, com propriedade mantida na empresa de origem.'],
      ['API para sistemas de clientes', 'Chaves por empresa, com permissões e revogação. Permite listar veículos, consultar posição e histórico e atualizar campos básicos do veículo.'],
      ['Integração de equipamentos', 'Recepção de posições, lotes, telemetria e eventos de vídeo por credencial individual ou gateway Traccar, conforme a integração.'],
      ['Briefings e melhorias', 'Importação de conteúdo, geração de propostas e acompanhamento. Os manuais de uso ficam dentro da plataforma.'],
    ],
  },
];

export default function VisaoPlataforma() {
  return <article className="visao-plataforma" aria-label="Funções da Linktrac Prime">
    <AcoesDaPagina><Link to="/manuais">Manuais de uso</Link></AcoesDaPagina>
    <p className="visao-plataforma-intro">
      A Linktrac Prime reúne rastreamento, gestão de frotas e roteirização de entregas.
      Cada empresa acessa sua frota e os módulos liberados para a equipe.
    </p>
    {modulos.map(({ titulo, funcoes }) => <details key={titulo}>
      <summary>{titulo}</summary>
      <dl>{funcoes.map(([nome, descricao]) => <div key={nome}>
        <dt>{nome}</dt>
        <dd>{descricao}</dd>
      </div>)}</dl>
    </details>)}
    <details>
      <summary>Disponibilidade e testes em campo</summary>
      <ul>
        <li>O acesso externo pelo celular depende da publicação da plataforma. O motorista já conta com telas web de rotas e entregas.</li>
        <li>GPS e vídeo dependem da configuração e homologação de cada equipamento. O aviso de radar ainda precisa ser validado em uma viagem com rastreador real.</li>
        <li>O Asaas já cadastra pagadores. A emissão de boletos, a cobrança recorrente e a conciliação de pagamentos seguem pendentes.</li>
        <li>Vídeo ao vivo, consulta automática de multas oficiais e comandos físicos de bloqueio seguem pendentes.</li>
      </ul>
    </details>
  </article>;
}
