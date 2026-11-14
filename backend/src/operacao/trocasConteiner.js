const estados = ['cheio', 'vazio'];
const tipos = ['recolher_cheio', 'recolher_vazio', 'deixar_cheio', 'deixar_vazio', 'descarregar'];

function identificador(valor) {
  if (typeof valor !== 'string') return null;
  const numero = valor.trim().toUpperCase().replace(/\s+/g, ' ');
  return /^[A-Z0-9][A-Z0-9 ./_-]{0,49}$/.test(numero) ? numero : null;
}

function rejeitar(mensagem) {
  throw Object.assign(new Error(mensagem), { status: 400 });
}

function simularCarga({ capacidade, cargaInicial, etapas }) {
  if (!Number.isInteger(capacidade) || capacidade < 1 || capacidade > 12 ||
      !Array.isArray(cargaInicial) || cargaInicial.length > capacidade) {
    rejeitar('Informe a capacidade do veículo em contêineres e confira a carga inicial.');
  }
  const carga = new Map();
  for (const item of cargaInicial) {
    const numero = identificador(item?.numero);
    if (!numero || !estados.includes(item.estado) || carga.has(numero)) {
      rejeitar('Confira os números, estados e duplicidades na carga inicial.');
    }
    carga.set(numero, item.estado);
  }
  const fotografar = () => [...carga].map(([numero, estado]) => ({ numero, estado }));
  const inicial = fotografar();
  const paradas = etapas.map((etapa, i) => {
    const rotulo = 'Parada ' + (i + 1) + ': ';
    if (!Array.isArray(etapa?.movimentos) || !etapa.movimentos.length || etapa.movimentos.length > 36) {
      rejeitar(rotulo + 'informe de 1 a 36 movimentações.');
    }
    const movimentos = etapa.movimentos.map(item => {
      const numero = identificador(item?.numero);
      const tipo = item?.tipo;
      if (!numero || !tipos.includes(tipo)) rejeitar(rotulo + 'confira o contêiner e a movimentação.');
      if (tipo === 'descarregar') {
        if (carga.get(numero) !== 'cheio') rejeitar(rotulo + numero + ' precisa estar cheio e a bordo para descarregar.');
        carga.set(numero, 'vazio');
      } else {
        const [acao, estado] = tipo.split('_');
        if (acao === 'recolher') {
          if (carga.has(numero)) rejeitar(rotulo + numero + ' já está a bordo.');
          if (carga.size >= capacidade) rejeitar(rotulo + 'a capacidade seria excedida. Registre primeiro a saída de um contêiner.');
          carga.set(numero, estado);
        } else {
          if (carga.get(numero) !== estado) rejeitar(rotulo + numero + ' precisa estar a bordo no estado informado.');
          carga.delete(numero);
        }
      }
      return { tipo, numero };
    });
    return { movimentos, cargaAposEtapa: fotografar() };
  });
  return { inicial, paradas };
}

module.exports = { simularCarga };
