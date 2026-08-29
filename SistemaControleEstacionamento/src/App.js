const CadastroClientes = require('./clientes/CadastroClientes');
const RegistroDeEntradas_E_Saidas = require('./estacionamento/RegistroDeEntradas_E_Saidas');
const RelatoriosGerenciais = require('./relatorios/RelatoriosGerenciais');
const ClientesCsv = require('./persistencia/ClientesCsv');
const TicketsCsv = require('./persistencia/TicketsCsv');
const BloqueiosCsv = require('./persistencia/BloqueiosCsv');

/**
  Fachada do sistema. Continua sem I/O interativo (console.log/leitura de
  input) — isso é o que permite a Fase 2 encaixar InterfaceUsuario por cima
  sem refatorar esta classe. Orquestrar leitura/escrita de arquivos CSV não é
  considerado I/O interativo para este fim (é dado, não interação com o
  usuário), por isso carregarTudo/salvarTudo vivem aqui.
*/
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

  /**
   * @returns {import('./clientes/Cliente')[]}
   */

  listarClientes() {
    return this.cadastroClientes.listarClientes();
  }

  /**
   * @param {string} documento
   * @returns {import('./clientes/Cliente')|null}
   */

  buscarClientePorDocumento(documento) {
    return this.cadastroClientes.buscarClientePorDocumento(documento);
  }

  /**
   * @param {string} placa
   * @returns {import('./clientes/Cliente')|null}
   */

  buscarClientePorPlaca(placa) {
    return this.cadastroClientes.buscarClientePorPlaca(placa);
  }

  /**
   * @param {string} placa
   * @returns {boolean}
   */

  veiculoEstaDentro(placa) {
    return this.registroDeEntradasESaidas.veiculoEstaDentro(placa);
  }

  /**
    Carrega clientes, tickets e bloqueios a partir dos 3 caminhos informados,
    nesta ordem (clientes precisa vir antes de tickets, pois a reconstrução do
    estado derivado do Professor depende do cadastro já estar populado).
   * @param {{ clientes: string, tickets: string, bloqueios: string }} caminhos
   */

  carregarTudo(caminhos) {
    ClientesCsv.carregar(caminhos.clientes, this.cadastroClientes);
    TicketsCsv.carregar(caminhos.tickets, this.registroDeEntradasESaidas);
    TicketsCsv.reconstruirEstadoDerivado(this.cadastroClientes, this.registroDeEntradasESaidas);
    BloqueiosCsv.carregar(caminhos.bloqueios, this.registroDeEntradasESaidas);
  }

  /**
    Salva clientes, tickets e bloqueios nos 3 caminhos informados,
    sobrescrevendo o conteúdo anterior de cada arquivo.
   * @param {{ clientes: string, tickets: string, bloqueios: string }} caminhos
   */

  salvarTudo(caminhos) {
    ClientesCsv.salvar(caminhos.clientes, this.cadastroClientes);
    TicketsCsv.salvar(caminhos.tickets, this.registroDeEntradasESaidas);
    BloqueiosCsv.salvar(caminhos.bloqueios, this.registroDeEntradasESaidas);
  }
}

module.exports = App;
