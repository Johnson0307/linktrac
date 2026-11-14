const { readFile } = require('node:fs/promises');

let cache;

function lerRegistros(arquivo) {
  return readFile(arquivo, 'utf8').then((texto) => {
    const registros = JSON.parse(texto.replace(/^\uFEFF/, ''));
    if (!Array.isArray(registros)) throw new Error('Formato inválido.');

    const porTac = new Map();
    for (const registro of registros) {
      const { tac, fabricante, modelo } = registro || {};
      if (typeof tac !== 'string' || !/^\d{8}$/.test(tac) ||
          typeof fabricante !== 'string' || !fabricante.trim() || fabricante.length > 100 ||
          typeof modelo !== 'string' || !modelo.trim() || modelo.length > 100) {
        throw new Error('Registro inválido.');
      }
      const atual = { fabricante: fabricante.trim(), modelo: modelo.trim() };
      const anterior = porTac.get(tac);
      if (anterior === undefined) {
        porTac.set(tac, atual);
      } else if (anterior && (anterior.fabricante !== atual.fabricante || anterior.modelo !== atual.modelo)) {
        porTac.set(tac, null);
      }
    }
    return porTac;
  });
}

async function consultarTac(tac) {
  const arquivo = process.env.TAC_BASE_ARQUIVO?.trim();
  if (!arquivo || typeof tac !== 'string' || !/^\d{8}$/.test(tac)) return null;
  if (cache?.arquivo !== arquivo) {
    cache = {
      arquivo,
      registros: lerRegistros(arquivo).catch(() => {
        console.error('Base TAC indisponível. Confira TAC_BASE_ARQUIVO e o formato do arquivo.');
        return null;
      }),
    };
  }
  const registros = await cache.registros;
  return registros?.get(tac) || null;
}

module.exports = { consultarTac };
