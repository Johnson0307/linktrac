import api from '../api/api';

function novaChave() {
  if (crypto.randomUUID) return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hexadecimal = [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
  return [hexadecimal.slice(0, 8), hexadecimal.slice(8, 12), hexadecimal.slice(12, 16),
    hexadecimal.slice(16, 20), hexadecimal.slice(20)].join('-');
}

function seletorDoFormulario(formulario, nome, inicial) {
  const rotulo = document.createElement('label');
  rotulo.textContent = nome;
  const seletor = document.createElement('select');
  seletor.add(new Option(inicial, ''));
  rotulo.append(seletor);
  formulario.append(rotulo);
  return seletor;
}

export function montarPublicacaoRota(painel, obterPontos) {
  const formulario = document.createElement('form');
  formulario.className = 'mapa-frota-publicar-rota';
  const veiculo = seletorDoFormulario(formulario, 'Veículo da rota', 'Selecione o veículo');
  veiculo.required = true;
  const motorista = seletorDoFormulario(formulario, 'Motorista da rota', 'Motorista vinculado ao veículo');
  const rotulo = document.createElement('label');
  rotulo.textContent = 'Nome da rota (opcional)';
  const titulo = document.createElement('input');
  titulo.maxLength = 80;
  rotulo.append(titulo);
  const publicar = document.createElement('button');
  publicar.type = 'submit';
  publicar.textContent = 'Publicar para motorista';
  const aviso = document.createElement('p');
  aviso.setAttribute('role', 'status');
  formulario.append(rotulo, publicar, aviso);
  painel.append(formulario);
  const consulta = new AbortController();
  let carregado = false;
  let disponivel = false;
  let enviando = false;
  let chave;
  let assinatura;
  let publicada;
  let erroOpcoes;

  function atualizar() {
    const pontos = obterPontos();
    const dados = pontos && { ...pontos, veiculoId: veiculo.value, motoristaId: motorista.value || undefined, titulo: titulo.value };
    publicar.disabled = !disponivel || !carregado || !veiculo.value || enviando || publicada === JSON.stringify(dados);
    return dados;
  }

  function mostrar(valor) {
    disponivel = valor;
    formulario.hidden = !valor;
    if (!valor) aviso.replaceChildren();
    if (valor && erroOpcoes) aviso.textContent = erroOpcoes;
    atualizar();
  }
  mostrar(false);
  api.get('/tms/opcoes', { signal: consulta.signal }).then(({ data }) => {
    if (consulta.signal.aborted) return;
    data.veiculos.forEach(item => veiculo.add(new Option([item.placa, item.modelo].filter(Boolean).join(' · '), item._id)));
    data.motoristas.forEach(item => motorista.add(new Option(item.nome, item._id)));
    carregado = true;
    atualizar();
  }).catch(() => {
    if (consulta.signal.aborted) return;
    erroOpcoes = 'Não foi possível carregar os veículos e motoristas. Reabra Traçar rota para tentar novamente.';
    aviso.textContent = erroOpcoes;
  });

  formulario.addEventListener('input', atualizar);
  formulario.addEventListener('submit', async evento => {
    evento.preventDefault();
    if (publicar.disabled) return;
    const dados = atualizar();
    if (!dados) return;
    const atual = JSON.stringify(dados);
    enviando = true;
    atualizar();
    aviso.textContent = 'Publicando para o motorista…';
    try {
      if (assinatura !== atual) {
        chave = novaChave();
        assinatura = atual;
      }
      const { data } = await api.post('/tms/rotas-mapa', { ...dados, chave });
      publicada = atual;
      const link = document.createElement('a');
      link.href = `/minhas-rotas?rota=${encodeURIComponent(data.dados._id)}`;
      link.textContent = 'Abrir rota publicada';
      aviso.replaceChildren('Rota disponível para o motorista. ', link);
    } catch (erro) {
      aviso.textContent = erro.response?.data?.mensagem || 'Não foi possível confirmar a publicação. Tente novamente.';
    } finally {
      enviando = false;
      atualizar();
    }
  });

  return { mostrar, fechar: () => consulta.abort() };
}
