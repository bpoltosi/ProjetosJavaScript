const CadastroClientes = require('./clientes/CadastroClientes');
const RegistroDeEntradas_E_Saidas = require('./estacionamento/RegistroDeEntradas_E_Saidas');
const RelatoriosGerenciais = require('./relatorios/RelatoriosGerenciais');
const ClientesCsv = require('./persistencia/ClientesCsv');
const TicketsCsv = require('./persistencia/TicketsCsv');
const BloqueiosCsv = require('./persistencia/BloqueiosCsv');
const VeiculosJson = require('./persistencia/VeiculosJson');
const ClienteAvulso = require('./clientes/ClienteAvulso');
const GerenciadorVagas = require('./estacionamento/GerenciadorVagas');
const EstadoVagasJson = require('./persistencia/EstadoVagasJson');

/**
  Fachada do sistema. Continua sem I/O interativo (console.log/leitura de
  input) — isso é o que permite a Fase 2 encaixar InterfaceUsuario por cima
  sem refatorar esta classe. Orquestrar leitura/escrita de arquivos CSV não é
  considerado I/O interativo para este fim (é dado, não interação com o
  usuário), por isso carregarTudo/salvarTudo vivem aqui.
*/
class App {
  constructor(configuracao = null) {
    this.configuracao = configuracao;
    this.cadastroClientes = new CadastroClientes();
    this.gerenciadorVagas = configuracao ? new GerenciadorVagas(configuracao) : null;
    this.registroDeEntradasESaidas = new RegistroDeEntradas_E_Saidas(this.cadastroClientes, this.gerenciadorVagas);
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

  registrarPlaca(documento, placa, caracteristicas) {
    return this.cadastroClientes.registrarPlaca(documento, placa, caracteristicas);
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

  listarVagas(filtros) {
    return this.gerenciadorVagas ? this.gerenciadorVagas.listarVagas(filtros) : [];
  }

  resumoVagas() {
    if (!this.gerenciadorVagas) return null;
    return {
      total: this.gerenciadorVagas.vagas.length,
      ocupadas: this.gerenciadorVagas.quantidadeOcupadas(),
      livres: this.gerenciadorVagas.quantidadeLivres(),
      bloqueadas: this.gerenciadorVagas.listarVagas({ status: 'bloqueada' }).length,
    };
  }

  /**
    Carrega clientes, tickets e bloqueios a partir dos 3 caminhos informados,
    nesta ordem (clientes precisa vir antes de tickets, pois a reconstrução do
    estado derivado do Professor depende do cadastro já estar populado).
   * @param {{ clientes: string, tickets: string, bloqueios: string }} caminhos
   */

  carregarTudo(caminhos) {
    ClientesCsv.carregar(caminhos.clientes, this.cadastroClientes);
    VeiculosJson.carregar(caminhos.veiculos, this.cadastroClientes);
    TicketsCsv.carregar(caminhos.tickets, this.registroDeEntradasESaidas);
    TicketsCsv.reconstruirEstadoDerivado(this.cadastroClientes, this.registroDeEntradasESaidas);
    BloqueiosCsv.carregar(caminhos.bloqueios, this.registroDeEntradasESaidas);
    EstadoVagasJson.carregar(caminhos.vagas, this.gerenciadorVagas);
    if (this.gerenciadorVagas) {
      for (const ticket of this.registroDeEntradasESaidas.ticketsAbertos.values()) {
        const cliente = this.cadastroClientes.buscarClientePorPlaca(ticket.placa) ?? new ClienteAvulso(ticket.placa);
        const veiculo = cliente.placas.get(ticket.placa);
        const vaga = this.gerenciadorVagas.restaurarOcupacao(ticket.vagaId, ticket.placa, cliente, veiculo);
        ticket.vagaId = vaga.id;
      }
    }
  }

  /**
    Salva clientes, tickets e bloqueios nos 3 caminhos informados,
    sobrescrevendo o conteúdo anterior de cada arquivo.
   * @param {{ clientes: string, tickets: string, bloqueios: string }} caminhos
   */

  salvarTudo(caminhos) {
    ClientesCsv.salvar(caminhos.clientes, this.cadastroClientes);
    VeiculosJson.salvar(caminhos.veiculos, this.cadastroClientes);
    EstadoVagasJson.salvar(caminhos.vagas, this.gerenciadorVagas);
    TicketsCsv.salvar(caminhos.tickets, this.registroDeEntradasESaidas);
    BloqueiosCsv.salvar(caminhos.bloqueios, this.registroDeEntradasESaidas);
  }
}

module.exports = App;
