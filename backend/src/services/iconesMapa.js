const mongoose = require('mongoose');

const veiculos = ['carro', 'caminhonete', 'caminhao', 'carreta', 'van', 'onibus', 'moto', 'bicicleta',
  'trator', 'escavadeira', 'empilhadeira', 'guindaste', 'equipamento', 'embarcacao', 'ambulancia', 'bombeiros'];
const lugares = ['casa', 'empresa', 'igreja', 'escola', 'hospital', 'posto', 'garagem', 'deposito', 'obra', 'referencia'];
const padroes = { veiculo: veiculos, lugar: lugares };
const maximoBytes = 16 * 1024;

const iconeMapaSchema = new mongoose.Schema({
  tipo: { type: String, required: true, enum: [...veiculos, ...lugares, 'personalizado'] },
  imagem: { type: String, maxlength: Math.ceil(maximoBytes / 3) * 4 + 24 },
}, { _id: false });

function imagemValida(imagem) {
  if (typeof imagem !== 'string' || imagem.length > Math.ceil(maximoBytes / 3) * 4 + 24) return false;
  const partes = /^data:image\/(png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(imagem);
  if (!partes) return false;
  const bytes = Buffer.from(partes[2], 'base64');
  if (bytes.length < 24 || bytes.length > maximoBytes || bytes.toString('base64') !== partes[2]) return false;
  if (partes[1] === 'png') {
    const largura = bytes.readUInt32BE(16);
    const altura = bytes.readUInt32BE(20);
    return bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) &&
      bytes.toString('ascii', 12, 16) === 'IHDR' && largura > 0 && largura <= 96 && altura > 0 && altura <= 96;
  }
  if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.readUInt32LE(4) + 8 !== bytes.length ||
      bytes.toString('ascii', 8, 12) !== 'WEBP') return false;
  const bloco = bytes.toString('ascii', 12, 16);
  if (bloco === 'VP8X' && bytes.length >= 30) {
    return bytes.readUIntLE(24, 3) < 96 && bytes.readUIntLE(27, 3) < 96 && !(bytes[20] & 2);
  }
  if (bloco === 'VP8L' && bytes[20] === 0x2f && bytes.length >= 25) {
    const tamanho = bytes.readUInt32LE(21);
    return (tamanho & 0x3fff) < 96 && ((tamanho >>> 14) & 0x3fff) < 96;
  }
  return bloco === 'VP8 ' && bytes.length >= 30 && bytes.subarray(23, 26).equals(Buffer.from('9d012a', 'hex')) &&
    (bytes.readUInt16LE(26) & 0x3fff) > 0 && (bytes.readUInt16LE(26) & 0x3fff) <= 96 &&
    (bytes.readUInt16LE(28) & 0x3fff) > 0 && (bytes.readUInt16LE(28) & 0x3fff) <= 96;
}

function normalizarIconeMapa(icone, grupo) {
  if (icone === null) return null;
  if (!icone || typeof icone !== 'object' || Array.isArray(icone) ||
      Object.keys(icone).some(campo => !['tipo', 'imagem'].includes(campo))) return undefined;
  if (padroes[grupo].includes(icone.tipo) && icone.imagem === undefined) return { tipo: icone.tipo };
  if (icone.tipo === 'personalizado' && imagemValida(icone.imagem)) return { tipo: icone.tipo, imagem: icone.imagem };
  return undefined;
}

module.exports = { iconeMapaSchema, normalizarIconeMapa };
