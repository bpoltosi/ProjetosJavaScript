/*
  Registro de uma permanência.
  A identidade do cliente é resolvida pela placa
*/

class TicketEstacionamento {
  /**
   * @param {string} placa
   * @param {Date} dataHoraEntrada
  */
  constructor(placa, dataHoraEntrada) {
    /** @type {string} */
    this.placa = placa;
    /** @type {Date} */
    this.dataHoraEntrada = dataHoraEntrada;
    /** @type {Date|null} */
    this.dataHoraSaida = null;
    /** @type {number|null} */
    this.custoOriginal = null;
    /** @type {string} */
    this.descontoId = 'nenhum';
    /** @type {number} */
    this.valorDesconto = 0;
    /** @type {number|null} */
    this.valorDevido = null;
    /** @type {number|null} */
    this.valorPago = null;
  }

  /**
    Preenche os campos de saída de uma vez.
    (valorDevido) é calculado internamente como custoOriginal − valorDesconto.
  * @param {{ dataHoraSaida: Date, custoOriginal: number, descontoId?: string, valorDesconto?: number, valorPago: number }} dados
  */

  fecharSaida({ dataHoraSaida, custoOriginal, descontoId, valorDesconto, valorPago }) {
    this.dataHoraSaida = dataHoraSaida;
    this.custoOriginal = custoOriginal;
    this.descontoId = descontoId ?? 'nenhum';
    this.valorDesconto = valorDesconto ?? 0;
    this.valorDevido = this.custoOriginal - this.valorDesconto;
    this.valorPago = valorPago;
  }

  /** 
  * @returns {boolean}
  */

  estaAberto() {
    return this.dataHoraSaida === null;
  }
}

module.exports = TicketEstacionamento;