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
const RegistroEventos = require('./estacionamento/RegistroEventos');
const GeradorClientes = require('./estacionamento/GeradorClientes');

/**
  Fachada do sistema. Continua sem I/O interativo (console.log/leitura de
  input) — isso é o que permite a Fase 2 encaixar InterfaceUsuario por cima
  sem refatorar esta classe. Orquestrar leitura/escrita de arquivos CSV não é
  considerado I/O interativo para este fim (é dado, não interação com o
  usuário), por isso carregarTudo/salvarTudo vivem aqui.
*/
class App {
  constructor(configuracao = null, opcoes = {}) {
    this.configuracao = configuracao;
    this.cadastroClientes = new CadastroClientes();
    this.gerenciadorVagas = configuracao ? new GerenciadorVagas(configuracao) : null;
    this.registroEventos = new RegistroEventos(opcoes.caminhoEventos ?? null);
    this.registroDeEntradasESaidas = new RegistroDeEntradas_E_Saidas(
      this.cadastroClientes,
      this.gerenciadorVagas,
      this.registroEventos
    );
    this.relatoriosGerenciais = new RelatoriosGerenciais(
      this.cadastroClientes,
      this.registroDeEntradasESaidas
    );
    this.geradorClientes = new GeradorClientes(this);
  }

  /**
   * @param {string} placa
   * @returns {import('./estacionamento/TicketEstacionamento')}
   */

  autorizarEntrada(placa, opcoes) {
    return this.registroDeEntradasESaidas.autorizarEntrada(placa, opcoes);
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

  gerarClientes(opcoes) {
    return this.geradorClientes.gerar(opcoes);
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

  consultarEventos(filtros) {
    return this.registroEventos.consultar(filtros);
  }

  bloquearVaga(id, opcoes = {}) {
    if (!this.gerenciadorVagas) throw new Error('gerenciador de vagas não configurado');
    const vaga = this.gerenciadorVagas.buscarPorId(id);
    if (!vaga) throw new Error(`vaga não encontrada: ${id}`);
    if (vaga.status === 'ocupada') throw new Error('não é possível bloquear uma vaga ocupada');
    if (vaga.status === 'bloqueada') throw new Error('vaga já está bloqueada');

    this.registroEventos.registrar({
      tipo: 'VAGA_BLOQUEADA',
      resultado: 'bloqueada',
      vagaId: vaga.id,
      origem: opcoes.origem ?? 'manual',
      detalhes: `Vaga ${vaga.id} bloqueada para manutenção/indisponibilidade.`,
    });
    return this.gerenciadorVagas.bloquear(id);
  }

  desbloquearVaga(id, opcoes = {}) {
    if (!this.gerenciadorVagas) throw new Error('gerenciador de vagas não configurado');
    const vaga = this.gerenciadorVagas.buscarPorId(id);
    if (!vaga) throw new Error(`vaga não encontrada: ${id}`);
    if (vaga.status !== 'bloqueada') throw new Error('vaga não está bloqueada');

    this.registroEventos.registrar({
      tipo: 'VAGA_DESBLOQUEADA',
      resultado: 'livre',
      vagaId: vaga.id,
      origem: opcoes.origem ?? 'manual',
      detalhes: `Vaga ${vaga.id} liberada para operação.`,
    });
    return this.gerenciadorVagas.desbloquear(id);
  }

  /**
    Carrega clientes, tickets e bloqueios a partir dos 3 caminhos informados,
    nesta ordem (clientes precisa vir antes de tickets, pois a reconstrução do
    estado derivado do Professor depende do cadastro já estar populado).
   * @param {{ clientes: string, tickets: string, bloqueios: string }} caminhos
   */

  carregarTudo(caminhos) {
    if (caminhos.eventos) this.registroEventos.carregar(caminhos.eventos);
    ClientesCsv.carregar(caminhos.clientes, this.cadastroClientes, this.configuracao);
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
