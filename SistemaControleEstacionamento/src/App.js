const CadastroClientes = require('./clientes/CadastroClientes');
const RegistroDeEntradas_E_Saidas = require('./estacionamento/RegistroDeEntradas_E_Saidas');
const RelatoriosGerenciais = require('./relatorios/RelatoriosGerenciais');

class App {
  constructor() {
    this.cadastroClientes = new CadastroClientes();
    this.registroDeEntradasESaidas = new RegistroDeEntradas_E_Saidas(this.cadastroClientes);
    this.relatoriosGerenciais = new RelatoriosGerenciais(
      this.cadastroClientes,
      this.registroDeEntradasESaidas
    );
  }

  /**
   * @param {string} placa
   * @returns {import('./estacionamento/TicketEstacionamento')}
   */

  autorizarEntrada(placa) {
    return this.registroDeEntradasESaidas.autorizarEntrada(placa);
  }

  /**
   * @param {string} placa
   * @param {{ pagamentoRecusado?: boolean }} [opcoes]
   * @returns {import('./estacionamento/TicketEstacionamento')}
   */

  processarSaida(placa, opcoes) {
    return this.registroDeEntradasESaidas.processarSaida(placa, opcoes);
  }

  /**
   * @param {import('./clientes/Cliente')} cliente
   */

  cadastrarCliente(cliente) {
    return this.cadastroClientes.cadastrarCliente(cliente);
  }

  /**
   * @param {string} documento
   * @param {string} placa
   */

  registrarPlaca(documento, placa) {
    return this.cadastroClientes.registrarPlaca(documento, placa);
  }

  removerPlaca(documento, placa) {
  return this.cadastroClientes.removerPlaca(documento, placa);
  }
}

module.exports = App;
