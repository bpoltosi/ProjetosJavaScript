const Desconto = require('./Desconto');

/*
  20% de desconto para avulso com 3 ou mais usos nos últimos 5 dias corridos.
*/

class DescontoClienteFrequente extends Desconto {
  constructor() {
    super('ClienteFrequente');
  }

  /**
   * Janela: dia de `dataAtual` e os 4 dias de calendário anteriores (5 dias inclusive).
   * @param {Array<{ dataHoraEntrada: Date }>} historicoTicketsDaPlaca
   * @param {Date} dataAtual
   * @returns {boolean}
  */

  aplicavel(historicoTicketsDaPlaca, dataAtual) {
    const historico = historicoTicketsDaPlaca ?? [];
    const inicioJanela = new Date(
      dataAtual.getFullYear(),
      dataAtual.getMonth(),
      dataAtual.getDate() - 4
    );

    const usosNaJanela = historico.filter((ticket) => {
      const entrada = ticket.dataHoraEntrada;
      return entrada >= inicioJanela && entrada <= dataAtual;
    }).length;
    return usosNaJanela >= 3;
  }

  /**
   * @param {number} valorBase
   * @returns {number}
  */
 
  aplicar(valorBase) {
    return Math.round(valorBase * 0.8 * 100) / 100;
  }
}

module.exports = DescontoClienteFrequente;