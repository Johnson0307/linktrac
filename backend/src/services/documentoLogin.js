const digito = (base, pesos) => {
  const resto = pesos.reduce((soma, peso, i) => soma + (base.charCodeAt(i) - 48) * peso, 0) % 11;
  return resto < 2 ? '0' : String(11 - resto);
};

function normalizarDocumento(valor) {
  if (typeof valor !== 'string' || valor.length > 32 || !/^[a-z0-9./\s-]+$/i.test(valor)) return null;
  const documento = valor.toUpperCase().replace(/[./\s-]/g, '');
  if (/^(.)\1+$/.test(documento)) return null;
  if (/^\d{11}$/.test(documento)) {
    const base = documento.slice(0, 9);
    const pesos = [10, 9, 8, 7, 6, 5, 4, 3, 2];
    const primeiro = digito(base, pesos);
    const segundo = digito(base + primeiro, [11, ...pesos]);
    return documento === base + primeiro + segundo ? documento : null;
  }
  if (/^[A-Z0-9]{12}\d{2}$/.test(documento)) {
    const base = documento.slice(0, 12);
    const pesos = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const primeiro = digito(base, pesos);
    const segundo = digito(base + primeiro, [6, ...pesos]);
    return documento === base + primeiro + segundo ? documento : null;
  }
  return null;
}

module.exports = { normalizarDocumento };
