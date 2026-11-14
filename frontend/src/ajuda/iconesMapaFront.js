export const veiculosMapa = {
  carro: ['🚗', 'Carro'], caminhonete: ['🛻', 'Caminhonete'], caminhao: ['🚚', 'Caminhão'],
  carreta: ['🚛', 'Carreta'], van: ['🚐', 'Van'], onibus: ['🚌', 'Ônibus'],
  moto: ['🏍️', 'Moto'], bicicleta: ['🚲', 'Bicicleta'], trator: ['🚜', 'Trator'],
  escavadeira: ['🚧', 'Escavadeira'], empilhadeira: ['📦', 'Empilhadeira'], guindaste: ['🏗️', 'Guindaste'],
  equipamento: ['⚙️', 'Máquina ou equipamento'], embarcacao: ['🚤', 'Embarcação'],
  ambulancia: ['🚑', 'Ambulância'], bombeiros: ['🚒', 'Caminhão de bombeiros'],
};

export const lugaresMapa = {
  casa: ['🏠', 'Casa'], empresa: ['🏢', 'Empresa'], igreja: ['⛪', 'Igreja'],
  escola: ['🏫', 'Escola'], hospital: ['🏥', 'Hospital'], posto: ['⛽', 'Posto de combustível'],
  garagem: ['🅿️', 'Garagem'], deposito: ['🏭', 'Depósito'], obra: ['🏗️', 'Obra'],
  referencia: ['📍', 'Ponto de referência'],
};

export function dadosIconeMapa(icone, padrao = 'caminhao') {
  if (icone?.tipo === 'personalizado' && /^data:image\/(png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(icone.imagem)) {
    return { imagem: icone.imagem, nome: 'Imagem personalizada' };
  }
  const tipo = icone?.tipo;
  const [simbolo, nome] = (Object.hasOwn(veiculosMapa, tipo) && veiculosMapa[tipo])
    || (Object.hasOwn(lugaresMapa, tipo) && lugaresMapa[tipo]) || veiculosMapa[padrao] || lugaresMapa[padrao];
  return { simbolo, nome };
}

export function criarIconeMapa(icone, padrao) {
  const { imagem, simbolo } = dadosIconeMapa(icone, padrao);
  const elemento = document.createElement(imagem ? 'img' : 'span');
  elemento.className = 'icone-mapa';
  elemento.setAttribute('aria-hidden', 'true');
  if (imagem) {
    elemento.src = imagem;
    elemento.alt = '';
  } else elemento.textContent = simbolo;
  return elemento;
}
