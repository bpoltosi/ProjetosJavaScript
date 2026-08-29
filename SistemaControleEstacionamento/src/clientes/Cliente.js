/*
    Classe abstrata base de cliente do estacionamento.
    Não deve ser instanciada diretamente.
*/

class Cliente {

  /**
   * @param {string|null} documento  (CPF ou CNPJ)
   * @param {string|null} nome
   */

  constructor(documento, nome) {
    if (new.target === Cliente) {
      throw new Error('Cliente é abstrata e não pode ser instanciada diretamente');
    }

    /** @type {string|null} */
    this.documento = documento ?? null;
    /** @type {string|null} */
    this.nome = nome ?? null;
    /** @type {Set<string>} */
    this.placas = new Set();
  }

  /**
      Adiciona uma placa respeitando o limite do subtipo.
   * @param {string} placa
   * @abstract
   */

  adicionarPlaca(placa) {
    throw new Error('adicionarPlaca deve ser implementado pela subclasse');
  }

  /**
      Remove a placa do conjunto deste cliente.
   * @param {string} placa
   */

  removerPlaca(placa) {
    this.placas.delete(placa);
  }

  /**
      Calcula o custo da permanência.
   * @param {Date} entrada
   * @param {Date} saida
   * @returns {number}
   * @abstract
   */

  calcularCusto(entrada, saida) {
    throw new Error('calcularCusto deve ser implementado pela subclasse');
  }

  /**
      Indica se uma nova entrada pode ser autorizada.
   * @param {object} [contexto]
   * @returns {boolean}
   * @abstract
   */

  podeAutorizarEntrada(contexto) {
    throw new Error('podeAutorizarEntrada deve ser implementado pela subclasse');
  }
}

module.exports = Cliente;