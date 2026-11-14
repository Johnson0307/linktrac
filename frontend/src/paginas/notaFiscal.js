export function codigoDaLeitura(valor) {
  const texto = valor.trim();
  if (/^[\d\s.-]+$/.test(texto)) {
    const digitos = texto.replace(/\D/g, '');
    if (digitos.length === 44) return { codigo: digitos, chaveNfe: digitos };
  }
  let decodificado = texto;
  try { decodificado = decodeURIComponent(texto); } catch { /* Código já lido como texto. */ }
  const chave = decodificado.match(/(?:^|\D)(\d{44})(?!\d)/)?.[1];
  if (chave) return { codigo: chave, chaveNfe: chave };
  if (!texto || texto.length > 100 || /^(?:https?:\/\/|data:|javascript:)/i.test(texto) || /[\r\n]/.test(texto)) {
    throw new Error('O código não contém uma chave de 44 dígitos nem um identificador de etiqueta válido.');
  }
  return { codigo: texto };
}

const filho = (no, nome) => Array.from(no?.children || []).find(el => el.localName === nome);
const texto = (no, nome) => filho(no, nome)?.textContent.trim() || '';

export function lerXmlNfe(xml) {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('O XML contém uma declaração não aceita.');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagNameNS('*', 'parsererror').length) throw new Error('XML inválido.');
  const infos = doc.getElementsByTagNameNS('*', 'infNFe');
  if (infos.length !== 1) throw new Error('Use um XML completo com uma NF-e ou NFC-e por arquivo.');
  const info = infos[0];
  const chaveNfe = info.getAttribute('Id')?.match(/^NFe(\d{44})$/)?.[1];
  if (!chaveNfe) throw new Error('Chave de acesso ausente no XML.');
  const destino = filho(info, 'dest');
  const entrega = filho(info, 'entrega');
  const endereco = texto(entrega, 'xLgr') ? entrega : filho(destino, 'enderDest');
  const rua = [texto(endereco, 'xLgr'), texto(endereco, 'nro')].filter(Boolean).join(', ');
  const local = [texto(endereco, 'xMun'), texto(endereco, 'UF')].filter(Boolean).join(' - ');
  return {
    codigo: chaveNfe, chaveNfe,
    destinatario: texto(entrega, 'xNome') || texto(destino, 'xNome'),
    endereco: [rua, texto(endereco, 'xCpl'), texto(endereco, 'xBairro'), local,
      texto(endereco, 'CEP')].filter(Boolean).join(', '),
  };
}
