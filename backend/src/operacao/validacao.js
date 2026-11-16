const { catalogo } = require('./catalogo');
const id = (v) => typeof v === 'string' && /^[a-f\d]{24}$/i.test(v);
const data = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v;
const horario = (v) => typeof v === 'string' && data(v.slice(0, 10)) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(v) && Number.isFinite(Date.parse(v));
function chaveValida(chave) {
  if (typeof chave !== 'string' || !/^\d{44}$/.test(chave)) return false;
  const soma = [...chave.slice(0, 43)].reverse()
    .reduce((total, digito, i) => total + Number(digito) * (2 + i % 8), 0);
  const resto = soma % 11;
  return Number(chave[43]) === (resto < 2 ? 0 : 11 - resto);
}

const validar = (tipo, body) => {
  const spec = Object.hasOwn(catalogo, tipo) ? catalogo[tipo] : null; const erros = []; const dados = {};
  if (!spec || !body || typeof body !== 'object' || Array.isArray(body)) return { erros: ['Dados inválidos.'] };
  for (const f of spec.campos) {
    let valor = body[f.key];
    if (valor === undefined || valor === '' || valor === null) {
      if (f.padrao !== undefined) valor = f.padrao;
      else { if (f.obrigatorio) erros.push(`${f.label} é obrigatório.`); continue; }
    }
    let valido;
    if (['numero', 'inteiro'].includes(f.tipo)) valido = typeof valor === 'number' && Number.isFinite(valor) && (f.tipo !== 'inteiro' || Number.isSafeInteger(valor)) && (f.min === undefined || valor >= f.min) && (f.max === undefined || valor <= f.max);
    else if (f.tipo === 'booleano') valido = typeof valor === 'boolean';
    else if (['veiculo', 'motorista', 'pneu'].includes(f.tipo)) valido = id(valor);
    else if (f.tipo === 'data') valido = data(valor);
    else if (f.tipo === 'datetime') valido = horario(valor);
    else if (f.tipo === 'opcoes') valido = typeof valor === 'string' && f.opcoes.includes(valor);
    else valido = typeof valor === 'string' && valor.trim().length > 0 && valor.length <= (f.key === 'observacao' ? 1000 : 300);
    if (!valido) erros.push(`Confira ${f.label}.`); else dados[f.key] = f.tipo === 'datetime' ? new Date(valor).toISOString() : typeof valor === 'string' ? valor.trim() : valor;
  }
  for (const [a, b] of [['inicio', 'fim'], ['vigenciaInicio', 'vigenciaFim'], ['janelaInicio', 'janelaFim']])
    if (dados[a] && dados[b] && Date.parse(dados[a]) >= Date.parse(dados[b])) erros.push('O início deve ser anterior ao fim.');
  if (tipo === 'planos') {
    if (!dados.intervaloKm && !dados.intervaloDias && !dados.intervaloHoras) erros.push('Informe intervalo em km, dias ou horas.');
    if (dados.intervaloKm && dados.ultimoOdometro === undefined) erros.push('Informe o odômetro da última revisão.');
    if (dados.intervaloHoras && dados.ultimoHorimetro === undefined) erros.push('Informe o horímetro da última revisão.');
  }
  if (tipo === 'cargas' && dados.chaveNfe && !chaveValida(dados.chaveNfe)) erros.push('Chave da NF-e inválida.');
  if (tipo === 'cargas' && dados.chaveNfe && dados.codigo !== dados.chaveNfe) erros.push('Use a chave da NF-e como código da entrega.');
  if (['abastecimentos', 'cargas'].includes(tipo) && ((dados.latitude === undefined) !== (dados.longitude === undefined))) erros.push('Informe latitude e longitude juntas.');
  if (tipo === 'movimentacoes' && ['montagem', 'rodizio', 'desmontagem'].includes(dados.tipo) && (!dados.veiculoId || dados.odometroKm === undefined || (dados.tipo !== 'desmontagem' && !dados.posicao))) erros.push('Informe veículo, odômetro e posição para a montagem ou rodízio.');
  return { erros, dados };
};
module.exports = { validar, id, data, horario };
