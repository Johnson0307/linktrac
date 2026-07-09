// src/servicos/filaRequisicoes.js
import { CONFIG } from '../config';

class FilaRequisicoes {
  constructor() {
    this.fila = [];
    this.processando = false;
    this.intervalo = 1000 / CONFIG.GEOCODIFICACAO.LIMITE_POR_SEGUNDO;
  }

  adicionar(funcao) {
    return new Promise((resolver, rejeitar) => {
      this.fila.push({ funcao, resolver, rejeitar });
      this.processar();
    });
  }

  async processar() {
    if (this.processando) return;
    this.processando = true;

    while (this.fila.length > 0) {
      const item = this.fila.shift();
      try {
        const resultado = await item.funcao();
        item.resolver(resultado);
      } catch (erro) {
        item.rejeitar(erro);
      }
      await new Promise((pausa) => setTimeout(pausa, this.intervalo));
    }

    this.processando = false;
  }
}

export const filaGeocodificacao = new FilaRequisicoes();
