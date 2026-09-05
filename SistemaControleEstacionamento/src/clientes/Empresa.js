const Cliente = require('./Cliente');
const Veiculo = require('../veiculos/Veiculo');
const { diasCalendarioTocados } = require('../util/data');

/*
    Cliente empresa: placas ilimitadas, cobrança por diária.
    Inadimplência bloqueia toda a frota.

    Correção B (plano-correcao-fase1.md): antes deste ajuste, a inadimplência
    só acontecia se alguém chamasse marcarInadimplente() manualmente — o
    saldoDevedor podia crescer indefinidamente sem nunca bloquear a frota.
    Agora existe um boleto com data de vencimento; verificarVencimento()
    transiciona automaticamente para inadimplente quando o vencimento passa
    e ainda há saldo devedor. A verificação é on-demand (chamada a partir de
    podeAutorizarEntrada), sem precisar de um scheduler.

    dataVencimentoBoleto é persistida em clientes.csv como 6ª coluna (decisão
    B.6 do plano de correção, reabrindo a decisão 1.1 do roadmap Fase 2) — ver
    ClientesCsv.js para o formato exato e a lógica de leitura/escrita.
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
    /** @type {Date|null} */
    this.dataVencimentoBoleto = null;
  }

  /**
   * Sem limite de placas.
   * @param {string} placa
   * @returns {string}
   */
  adicionarPlaca(placa) {
    const veiculo = new Veiculo(placa);
    this.placas.set(veiculo.placa, veiculo);
    return veiculo.placa;
  }

  /**
   * Acumula débito até o boleto.
   * @param {number} valor
   */
  registrarDebito(valor) {
    this.saldoDevedor += valor;
  }

  /**
    Emite um boleto com data de vencimento — a partir daqui,
    verificarVencimento() pode transicionar a empresa para inadimplente.
   * @param {Date} dataVencimento
  */
  emitirBoleto(dataVencimento) {
    this.dataVencimentoBoleto = dataVencimento;
  }

  //Marca a empresa como inadimplente (bloqueia a frota).
  marcarInadimplente() {
    this.inadimplente = true;
  }

  /**
    Quita o boleto: zera saldo devedor, remove o vencimento e libera a frota.
  */
  quitarBoleto() {
    this.inadimplente = false;
    this.saldoDevedor = 0;
    this.dataVencimentoBoleto = null;
  }

  /**
    Transição automática para inadimplente: se há boleto emitido, ainda há
    saldo devedor pendente e a data atual já passou do vencimento, marca a
    empresa como inadimplente. Não faz nada se já está em dia ou se ainda não
    venceu.
   * @param {Date} dataAtual
   * @returns {boolean} true se a empresa está (ou passou a estar) inadimplente
  */
  verificarVencimento(dataAtual) {
    if (
      this.dataVencimentoBoleto !== null &&
      this.saldoDevedor > 0 &&
      dataAtual > this.dataVencimentoBoleto
    ) {
      this.inadimplente = true;
    }
    return this.inadimplente;
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
    Antes de responder, verifica automaticamente se o boleto venceu (B.4:
    checagem on-demand, sem scheduler) — assim qualquer chamador
    (autorizarEntrada, listarBloqueados, relatórios) dispara a transição
    sem precisar saber que ela existe.
   * @returns {boolean}
   */

  podeAutorizarEntrada() {
    this.verificarVencimento(new Date());
    return !this.inadimplente;
  }
}

module.exports = Empresa;