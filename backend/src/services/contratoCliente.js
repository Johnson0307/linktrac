const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { inflateRawSync } = require('node:zlib');
const { falha } = require('./cadastroFinanceiro');

const tipoWord = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const tamanhoLimite = '4mb';
const camposContrato = ['prestadora_nome', 'prestadora_cnpj', 'cliente_nome', 'cliente_cpf_cnpj', 'cliente_email',
  'cliente_celular', 'cliente_cep', 'cliente_logradouro', 'cliente_numero', 'cliente_complemento', 'cliente_bairro',
  'cliente_cidade', 'cliente_uf', 'data_emissao', 'quantidade_veiculos', 'lista_veiculos'];

function compilar(arquivo, valores) {
  try {
    const zip = new PizZip(arquivo);
    const entradas = Object.values(zip.files);
    const expansao = entradas.reduce((total, item) => total + (item._data?.uncompressedSize ?? 0), 0);
    if (!zip.file('word/document.xml') || entradas.length > 200 || expansao > 20 * 1024 * 1024 ||
        entradas.some(({ name }) => /(?:vbaProject|embeddings\/|activeX\/)/i.test(name))) {
      throw new Error('Conteúdo inválido.');
    }
    for (const entrada of entradas) {
      const dados = entrada._data;
      if (dados?.compressionMethod !== '\x08\x00') continue;
      const bytes = inflateRawSync(Buffer.from(dados.getCompressedContent()), { maxOutputLength: Math.max(1, dados.uncompressedSize) });
      if (bytes.length !== dados.uncompressedSize) throw new Error('Tamanho de conteúdo inválido.');
    }
    const campos = new Set();
    const doc = new Docxtemplater(zip, {
      linebreaks: true,
      errorLogging: false,
      parser: (tag, contexto) => {
        campos.add(tag);
        if (!camposContrato.includes(tag) || contexto.tag?.module) throw new Error('Campo desconhecido.');
        return { get: (dados) => dados[tag] };
      },
    });
    doc.render(valores || Object.fromEntries(camposContrato.map(campo => [campo, ''])));
    if (!campos.has('cliente_nome') || !campos.has('cliente_cpf_cnpj') || !campos.has('lista_veiculos')) {
      throw new Error('Campos obrigatórios ausentes.');
    }
    return doc;
  } catch {
    throw falha(422, 'Use um modelo Word (.docx) com os campos {cliente_nome}, {cliente_cpf_cnpj} e {lista_veiculos}. Confira os campos aceitos.');
  }
}

function preencherContrato(modelo, prestadora, pagador, veiculos) {
  const doc = compilar(modelo, {
    prestadora_nome: prestadora.nome,
    prestadora_cnpj: prestadora.cnpj || '',
    cliente_nome: pagador.nome,
    cliente_cpf_cnpj: pagador.documento,
    cliente_email: pagador.email,
    cliente_celular: pagador.celular,
    cliente_cep: pagador.cep,
    cliente_logradouro: pagador.logradouro,
    cliente_numero: pagador.numero,
    cliente_complemento: pagador.complemento,
    cliente_bairro: pagador.bairro,
    cliente_cidade: pagador.cidade,
    cliente_uf: pagador.uf,
    data_emissao: new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo' }).format(new Date()),
    quantidade_veiculos: veiculos.length,
    lista_veiculos: veiculos.map(v => [v.placa, v.marca, v.modelo, v.ano].filter(Boolean).join(' · ')).join('\n') || 'Nenhum veículo selecionado',
  });
  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
}

module.exports = { compilar, preencherContrato, tipoWord, tamanhoLimite, camposContrato };
