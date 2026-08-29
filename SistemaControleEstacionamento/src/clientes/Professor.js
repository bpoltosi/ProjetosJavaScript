const Cliente = require('./Cliente');

/*
  Cliente professor: até 2 placas, entrada gratuita.
  Apenas um veículo do mesmo professor pode estar estacionado por vez.
  (placaAtualEstacionada) é atualizada por RegistroDeEntradas_E_Saidas.
*/

class Professor extends Cliente {
  /**
   * @param {string} documento
   * @param {string} nome
  */

  constructor(documento, nome) {
    super(documento, nome);
    /** @type {string|null} */
    this.placaAtualEstacionada = null;
  }

  /**
    Professor pode cadastrar no máximo duas placas.
   * @param {string} placa
  */

  adicionarPlaca(placa) {
    if (this.placas.size >= 2) {
      throw new Error('professor já possui o limite de 2 placas cadastradas');
    }
    this.placas.add(placa);
  }

  /**
    Permanência gratuita.
   * @returns {number}
  */

  calcularCusto() {
    return 0;
  }

  /**
    Autoriza apenas se nenhum veículo deste professor estiver dentro.
    O parâmetro contexto é ignorado: o estado já está em placaAtualEstacionada.
   * @param {object} [contexto]
   * @returns {boolean}
  */

  podeAutorizarEntrada(contexto) {
    return this.placaAtualEstacionada === null;
  }
}

module.exports = Professor;