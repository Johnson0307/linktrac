const { createHash } = require('node:crypto');

const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const normalizar = s => s.normalize('NFKC').trim().replace(/\s+/g, ' ');
const hash = s => createHash('sha256').update(s).digest('hex');
const cabecalho = /Briefing\s+Linktrac\s*[—–-]\s*(\d{1,2})\s+de\s+(\p{L}+)\s+de\s+(\d{4})/giu;
const ideia = /^\s*Ideia(?:\s+prática)?\s+para\s+a\s+Linktrac\s*:/i;
const categorias = [
  ['Videotelemetria', /videotelemetria|câmera|gravação|clipe/i],
  ['Roteirização', /roteir|\brota\b|navegação|entrega/i],
  ['Abastecimento e custos', /abasteci|combustível|economia|fraude/i],
  ['Telemetria e manutenção', /telemetria|odômetro|horímetro|manutenção/i],
  ['Integrações', /\bapi\b|webhook|conector|integraç|montadora/i],
  ['Motoristas', /motorista|condutor/i],
];

function dataEdicao(dia, mes, ano) {
  const numero = meses.indexOf(mes.toLowerCase()) + 1;
  if (!numero) return null;
  const iso = ano + '-' + String(numero).padStart(2, '0') + '-' + dia.padStart(2, '0');
  return Number.isFinite(Date.parse(iso)) && new Date(iso).toISOString().slice(0, 10) === iso ? iso : null;
}

function propostas(corpo) {
  const encontrados = [];
  let bloco = [];
  const fechar = () => { if (bloco.length) encontrados.push(bloco.join(' ')); bloco = []; };
  for (const linha of corpo.split(/\r?\n/)) {
    const colunas = linha.trimEnd().split(/\t+/);
    const tabela = colunas.length >= 2 ? colunas.at(-1).trim() : '';
    if (ideia.test(linha)) {
      fechar();
      bloco = [linha.replace(ideia, '').trim()];
    } else if (tabela && !/^ideia\b/i.test(tabela)) {
      fechar();
      encontrados.push(tabela);
    } else if (!linha.trim() || /^\s*(?:\d+[.)]\s|prioridade|status:|fonte:|briefing de frotas)/i.test(linha)) {
      fechar();
    } else if (bloco.length) {
      bloco.push(linha.trim());
    }
  }
  fechar();
  const unicos = new Map();
  for (const texto of encontrados.map(normalizar).filter(p => p.length >= 20 && p.length <= 2500)) {
    const id = hash(texto.toLowerCase()).slice(0, 24);
    const categoria = categorias.find(([, regex]) => regex.test(texto))?.[0] || 'Operação';
    if (!unicos.has(id)) unicos.set(id, { id, texto, categoria, status: 'para_revisao' });
  }
  return [...unicos.values()].slice(0, 50);
}

function interpretarBriefing(texto) {
  if (typeof texto !== 'string' || !texto.trim() || Buffer.byteLength(texto, 'utf8') > 60000) {
    throw new Error('Envie um briefing de até 60 KB.');
  }
  const titulos = [...texto.matchAll(cabecalho)];
  if (!titulos.length || titulos.length > 20) {
    throw new Error('Inclua até 20 edições com o título “Briefing Linktrac — dia de mês de ano”.');
  }
  return titulos.map((titulo, i) => {
    const data = dataEdicao(titulo[1], titulo[2], titulo[3]);
    const corpo = texto.slice(titulo.index + titulo[0].length, titulos[i + 1]?.index);
    const itens = propostas(corpo);
    if (!data || !itens.length) throw new Error('Confira a data e as propostas da edição ' + titulo[1] + ' de ' + titulo[2] + '.');
    return { data, hash: hash(data + ':' + itens.map(item => item.id).sort().join(',')), itens };
  });
}

module.exports = { interpretarBriefing };
