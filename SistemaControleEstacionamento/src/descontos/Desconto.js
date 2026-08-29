/*
    Estratégia abstrata de desconto.
*/

class Desconto {

  /**
   * @param {string} identificador
  */

  constructor(identificador) {
    if (new.target === Desconto) {
      throw new Error('Desconto é abstrata e não pode ser instanciada diretamente');
    }
    /** @type {string} */
    this.identificador = identificador;
  }

  /**
   * @param {Array<{ dataHoraEntrada: Date }>} historicoTicketsDaPlaca
   * @param {Date} dataAtual
   * @returns {boolean}
   * @abstract
  */

  aplicavel(historicoTicketsDaPlaca, dataAtual) {
    throw new Error('Aplicavel deve ser implementado pela subclasse');
  }

  /**
   * @param {number} valorBase
   * @returns {number}
   * @abstract
  */

  aplicar(valorBase) {
    throw new Error('aplicar deve ser implementado pela subclasse');
  }
}

module.exports = Desconto;