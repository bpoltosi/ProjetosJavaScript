const Cliente = require('./Cliente');
const { diasCalendarioTocados } = require('../util/data');

/*
    Cliente empresa: placas ilimitadas, cobrança por diária.
    Inadimplência bloqueia toda a frota.
*/

class Empresa extends Cliente {

  //Valor da diária (placeholder).
  static VALOR_DIARIA = 80;

  //Multa por cada dia extra após cruzar meia-noite (placeholder).
  static VALOR_MULTA_POR_DIA_EXTRA = 40;

  /**
   * @param {string} documento
   * @param {string} nome
   */
  constructor(documento, nome) {
    super(documento, nome);
    /** @type {number} */
    this.saldoDevedor = 0;
    /** @type {boolean} */
    this.inadimplente = false;
  }

  /**
   * Sem limite de placas.
   * @param {string} placa
   */
  adicionarPlaca(placa) {
    this.placas.add(placa);
  }

  /**
   * Acumula débito até o boleto.
   * @param {number} valor
   */
  registrarDebito(valor) {
    this.saldoDevedor += valor;
  }

  //Marca a empresa como inadimplente (bloqueia a frota).
  marcarInadimplente() {
    this.inadimplente = true;
  }

  //Quita o boleto, zera o saldo devedor e libera a frota.
  quitarBoleto() {
    this.inadimplente = false;
    this.saldoDevedor = 0;
  }

  /**
    Diária + multa × quantas meias-noites o intervalo cruzou.
    Mesmo dia: só a diária. Cada meia-noite cruzada gera um dia extra de multa.
   * @param {Date} entrada
   * @param {Date} saida
   * @returns {number}
   */

  calcularCusto(entrada, saida) {
    const meiasNoitesCruzadas = Math.max(0, diasCalendarioTocados(entrada, saida) - 1);
    return Empresa.VALOR_DIARIA + Empresa.VALOR_MULTA_POR_DIA_EXTRA * meiasNoitesCruzadas;
  }

  /**
   * @returns {boolean}
   */

  podeAutorizarEntrada() {
    return !this.inadimplente;
  }
}

module.exports = Empresa;