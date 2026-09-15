/*
    Representa um veículo cadastrado, identificado pela placa.

    Motivação (plano-correcao-fase1.md, Correção A): o enunciado pede
    explicitamente uma classe para "Veículos e placas" — antes deste ajuste,
    a placa era tratada diretamente como String dentro de Cliente.

    A placa é normalizada (sem espaços nas pontas, maiúsculas) para que o
    mesmo veículo não seja tratado como dois diferentes por causa de
    diferença de caixa ou espaço acidental na digitação.
*/

class Veiculo {
  /**
    Normaliza uma placa bruta (trim + maiúsculas) e valida que não é vazia.
    Usado tanto pelo construtor quanto por quem precisa da chave normalizada
    sem necessariamente criar uma instância (ex.: remoção/busca de placa).
   * @param {string} placa
   * @returns {string}
   */

  static normalizar(placa) {
    if (typeof placa !== 'string' || placa.trim().length === 0) {
      throw new Error('placa inválida: deve ser uma string não vazia');
    }
    return placa.trim().toUpperCase();
  }

  /**
   * @param {string} placa
   */

  constructor(placa) {
    /** @type {string} */
    this.placa = Veiculo.normalizar(placa);
  }

  /**
   * @returns {string}
   */

  toString() {
    return this.placa;
  }
}

module.exports = Veiculo;
