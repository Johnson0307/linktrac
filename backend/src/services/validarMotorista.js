const categorias = ['A', 'B', 'C', 'D', 'E', 'AB', 'AC', 'AD', 'AE'];
const status = ['ativo', 'inativo', 'ferias'];
const validarMotorista = (body = {}) => {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { erros: ['Informe os dados do motorista.'], dados: null };
  const erros = [];
  const nomes = { nome: 'Nome', cpf: 'CPF', cnh: 'CNH', validadeCnh: 'Validade da CNH', categoriaCnh: 'Categoria da CNH', status: 'Situação', telefone: 'Telefone', email: 'E-mail', endereco: 'Endereço', observacoes: 'Observações', identificador: 'Identificador integrado' };
  const texto = (campo, max, obrigatorio = false) => {
    const valor = body[campo];
    if (valor === undefined && !obrigatorio) return '';
    if (typeof valor !== 'string' || valor.length > max || (obrigatorio && !valor.trim())) {
      erros.push(`Confira o campo ${nomes[campo]} (máximo ${max} caracteres).`); return '';
    }
    return valor.trim();
  };
  const nome = texto('nome', 120, true);
  const cpfTexto = texto('cpf', 20, true);
  const cpf = /^[\d.\-\s]+$/.test(cpfTexto) ? cpfTexto.replace(/[.\-\s]/g, '') : '';
  const cnh = texto('cnh', 11, true);
  if (!/^\d{11}$/.test(cpf)) erros.push('CPF deve conter 11 dígitos.');
  if (!/^\d{11}$/.test(cnh)) erros.push('CNH deve conter 11 dígitos.');
  const validadeCnh = texto('validadeCnh', 10, true);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(validadeCnh) || !Number.isFinite(Date.parse(validadeCnh)) || new Date(validadeCnh).toISOString().slice(0, 10) !== validadeCnh)
    erros.push('Informe uma data válida para o vencimento da CNH.');
  const categoriaCnh = texto('categoriaCnh', 2, true).toUpperCase();
  if (!categorias.includes(categoriaCnh)) erros.push('Categoria da CNH inválida.');
  const situacao = body.status === undefined ? 'ativo' : texto('status', 10, true);
  if (!status.includes(situacao)) erros.push('Situação do motorista inválida.');
  const email = texto('email', 200).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) erros.push('Informe um e-mail válido.');
  const dados = { nome, cpf, cnh, validadeCnh, categoriaCnh, status: situacao, email,
    identificador: texto('identificador', 80),
    telefone: texto('telefone', 30), endereco: texto('endereco', 300), observacoes: texto('observacoes', 1000) };
  return { erros, dados };
};
module.exports = { validarMotorista, categorias, status };
