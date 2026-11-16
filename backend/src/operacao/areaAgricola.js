const metrosPorGrau = 111195;
const limiteAnalise = 1500000;
const falha = mensagem => Object.assign(new Error(mensagem), { status: 422 });
const produto = (a, b) => a.x * b.y - a.y * b.x;
const subtrair = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
const lado = (a, b, c) => produto(subtrair(b, a), subtrair(c, a));
const pontoValido = p => Number.isFinite(p?.latitude) && Math.abs(p.latitude) <= 85 &&
  Number.isFinite(p.longitude) && Math.abs(p.longitude) <= 180;

function cruzam(a, b, c, d) {
  const dentro = (p, r, s) => p.x >= Math.min(r.x, s.x) && p.x <= Math.max(r.x, s.x) &&
    p.y >= Math.min(r.y, s.y) && p.y <= Math.max(r.y, s.y);
  const [ac, ad, ca, cb] = [lado(a, b, c), lado(a, b, d), lado(c, d, a), lado(c, d, b)];
  return (ac * ad < 0 && ca * cb < 0) || (ac === 0 && dentro(c, a, b)) || (ad === 0 && dentro(d, a, b)) ||
    (ca === 0 && dentro(a, c, d)) || (cb === 0 && dentro(b, c, d));
}

function dentroDoTalhao({ x, y }, vertices) {
  let dentro = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    const a = vertices[i], b = vertices[j];
    if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) dentro = !dentro;
  }
  return dentro;
}

function prepararTalhao(entrada) {
  if (!Array.isArray(entrada) || entrada.length < 3 || entrada.length > 80 || !entrada.every(pontoValido)) {
    throw falha('Desenhe um talhão de 3 a 80 vértices válidos.');
  }
  const origem = entrada[0];
  const escalaX = metrosPorGrau * Math.cos(origem.latitude * Math.PI / 180);
  const projetar = p => ({ x: (p.longitude - origem.longitude) * escalaX, y: (p.latitude - origem.latitude) * metrosPorGrau });
  const vertices = entrada.map(projetar);
  const xs = vertices.map(p => p.x), ys = vertices.map(p => p.y);
  const menorX = Math.min(...xs), menorY = Math.min(...ys);
  const largura = Math.max(...xs) - menorX, altura = Math.max(...ys) - menorY;
  if (largura > 15000 || altura > 15000) throw falha('Salve separadamente talhões com mais de 15 km em um lado.');
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    if (Math.hypot(a.x - b.x, a.y - b.y) < 1) throw falha('Mantenha ao menos 1 m entre os vértices.');
    area += produto(a, b);
    for (let j = i + 2; j < vertices.length; j++) {
      if (i === 0 && j === vertices.length - 1) continue;
      if (cruzam(a, b, vertices[j], vertices[(j + 1) % vertices.length])) throw falha('As bordas do talhão não podem se cruzar.');
    }
  }
  area = Math.abs(area) / 2;
  if (area < 25) throw falha('Desenhe um talhão com pelo menos 25 m².');
  return { projetar, vertices, area, largura, altura, menorX, menorY };
}

function velocidadeDeTrabalho(p) {
  return pontoValido(p) && p.ignicao === true && p.status !== 'Sem sinal' && p.velocidade >= 1 && p.velocidade <= 25;
}

function calcularArea(entrada, pontos, larguraImplemento) {
  const { projetar, vertices, area, largura, altura, menorX, menorY } = prepararTalhao(entrada);
  const passo = larguraImplemento < 4 ? 0.5 : larguraImplemento <= 20 ? 1 : 2;
  const colunas = Math.ceil(largura / passo), linhas = Math.ceil(altura / passo);
  const meiaLargura = larguraImplemento / 2;
  const cobertas = new Set();
  const segmentos = [];
  let verificacoes = 0;
  for (let i = 1; i < pontos.length; i++) {
    const anterior = pontos[i - 1], atual = pontos[i];
    const segundos = (+new Date(atual.dataHora) - +new Date(anterior.dataHora)) / 1000;
    if (!velocidadeDeTrabalho(anterior) || !velocidadeDeTrabalho(atual) || segundos < 1 || segundos > 120) continue;
    const a = projetar(anterior), b = projetar(atual), v = subtrair(b, a);
    const medida = Math.hypot(v.x, v.y);
    if (medida < 1 || medida * 3.6 / segundos > 30) continue;
    let cruzou = false;
    const divisoes = Math.ceil(medida / 30);
    for (let n = 0; n < divisoes; n++) {
      const p = { x: a.x + v.x * n / divisoes, y: a.y + v.y * n / divisoes };
      const q = { x: a.x + v.x * (n + 1) / divisoes, y: a.y + v.y * (n + 1) / divisoes };
      const i0 = Math.max(0, Math.floor((Math.min(p.x, q.x) - meiaLargura - menorX) / passo));
      const i1 = Math.min(colunas - 1, Math.floor((Math.max(p.x, q.x) + meiaLargura - menorX) / passo));
      const j0 = Math.max(0, Math.floor((Math.min(p.y, q.y) - meiaLargura - menorY) / passo));
      const j1 = Math.min(linhas - 1, Math.floor((Math.max(p.y, q.y) + meiaLargura - menorY) / passo));
      for (let x = i0; x <= i1; x++) for (let y = j0; y <= j1; y++) {
        if (++verificacoes > limiteAnalise) throw falha('Reduza o período para calcular a área deste talhão.');
        const centro = { x: menorX + (x + 0.5) * passo, y: menorY + (y + 0.5) * passo };
        const w = subtrair(centro, a);
        const projecao = (w.x * v.x + w.y * v.y) / medida;
        if (projecao < 0 || projecao > medida || Math.abs(produto(v, w)) / medida > meiaLargura ||
            !dentroDoTalhao(centro, vertices)) continue;
        cobertas.add(x + y * colunas);
        cruzou = true;
      }
    }
    if (cruzou) segmentos.push([[anterior.latitude, anterior.longitude], [atual.latitude, atual.longitude]]);
  }
  return { areaTalhaoHa: area / 10000, areaTrabalhadaHa: Math.min(area, cobertas.size * passo ** 2) / 10000,
    resolucaoMetros: passo, segmentos };
}

module.exports = { prepararTalhao, calcularArea };
