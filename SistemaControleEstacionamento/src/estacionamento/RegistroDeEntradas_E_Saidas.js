const TicketEstacionamento = require('./TicketEstacionamento');
const ClienteAvulso = require('../clientes/ClienteAvulso');
const DescontoClienteFrequente = require('../descontos/DescontoClienteFrequente');

/*
  Orquestra entradas, saídas, capacidade, bloqueio de avulsos e descontos.
*/
class RegistroDeEntradas_E_Saidas {
  static CAPACIDADE_TOTAL = 9000;

  /**
   * @param {import('../clientes/CadastroClientes')} cadastroClientes
  */

  constructor(cadastroClientes) {
    this.cadastroClientes = cadastroClientes;
    /** @type {import('../descontos/Desconto')[]} */
    this.descontosDisponiveis = [new DescontoClienteFrequente()];
    /** @type {Map<string, TicketEstacionamento>} */
    this.ticketsAbertos = new Map();
    /** @type {Map<string, TicketEstacionamento[]>} */
    this.historicoPorPlaca = new Map();
    /** @type {Set<string>} */
    this.placasBloqueadas = new Set();
  }

  /**
   * @returns {boolean}
  */

  possuiVagaDisponivel() {
    return this.ticketsAbertos.size < RegistroDeEntradas_E_Saidas.CAPACIDADE_TOTAL;
  }

  /**
   * @param {string} placa
   * @returns {boolean}
  */

  veiculoEstaDentro(placa) {
    return this.ticketsAbertos.has(placa);
  }

  /**
   * @param {string} placa
   * @returns {TicketEstacionamento}
  */

  autorizarEntrada(placa) {
    if (this.placasBloqueadas.has(placa)) {
      throw new Error('placa bloqueada');
    }
    if (this.veiculoEstaDentro(placa)) {
      throw new Error('veículo já está dentro do estacionamento');
    }
    if (!this.possuiVagaDisponivel()) {
      throw new Error('estacionamento lotado');
    }

    const cliente = this.cadastroClientes.buscarClientePorPlaca(placa);
    if (cliente) {
      const autorizado = cliente.podeAutorizarEntrada({
        ticketsAbertos: this.ticketsAbertos,
      });
      if (!autorizado) {
        throw new Error('entrada não autorizada para este cliente');
      }
    }

    const ticket = new TicketEstacionamento(placa, new Date());
    this.ticketsAbertos.set(placa, ticket);

    if (cliente && 'placaAtualEstacionada' in cliente) {
      cliente.placaAtualEstacionada = placa;
    }
    return ticket;
  }

  /**
   * @param {string} placa
   * @param {{ pagamentoRecusado?: boolean }} [opcoes]
   * @returns {TicketEstacionamento}
  */

  processarSaida(placa, opcoes = {}) {
    if (!this.veiculoEstaDentro(placa)) {
      throw new Error('veículo não está registrado como dentro');
    }

    const ticket = this.ticketsAbertos.get(placa);
    this.ticketsAbertos.delete(placa);

    const cliente = this.cadastroClientes.buscarClientePorPlaca(placa);
    if (cliente && 'placaAtualEstacionada' in cliente) {
      cliente.placaAtualEstacionada = null;
    }

    const dataHoraSaida = new Date();
    let custoOriginal;
    let descontoId = 'nenhum';
    let valorDesconto = 0;
    let valorPago;

    if (cliente) {
      custoOriginal = cliente.calcularCusto(ticket.dataHoraEntrada, dataHoraSaida);
      valorPago = custoOriginal;
      if (typeof cliente.debitar === 'function') {
        cliente.debitar(custoOriginal);
      }
      if (typeof cliente.registrarDebito === 'function') {
        cliente.registrarDebito(custoOriginal);
      }
    } else {
      const historico = this.buscarTicketsPorPlacaEPeriodo(
        placa,
        new Date(0),
        dataHoraSaida
      );

      // Inclui a permanencia atual para que a 3 visita possa receber o desconto.
      const historicoParaDesconto = [...historico, ticket];
      const descontoEncontrado = this.descontosDisponiveis.find((desconto) =>
        desconto.aplicavel(historicoParaDesconto, dataHoraSaida)
      );

      const avulso = new ClienteAvulso(placa);
      const valorComDesconto = avulso.calcularCusto(
        ticket.dataHoraEntrada,
        dataHoraSaida,
        descontoEncontrado ?? undefined
      );

      custoOriginal = avulso.calcularCusto(ticket.dataHoraEntrada, dataHoraSaida);
      valorDesconto = custoOriginal - valorComDesconto;
      descontoId = descontoEncontrado ? descontoEncontrado.identificador : 'nenhum';

      const valorDevido = custoOriginal - valorDesconto;
      if (opcoes.pagamentoRecusado === true) {
        valorPago = 0;
        this.placasBloqueadas.add(placa);
      } else {
        valorPago = valorDevido;
      }
    }

    ticket.fecharSaida({
      dataHoraSaida,
      custoOriginal,
      descontoId,
      valorDesconto,
      valorPago,
    });

    if (!this.historicoPorPlaca.has(placa)) {
      this.historicoPorPlaca.set(placa, []);
    }
    this.historicoPorPlaca.get(placa).push(ticket);
    return ticket;
  }

  /**
   * @param {string} placa
   * @param {Date} inicio
   * @param {Date} fim
   * @returns {TicketEstacionamento[]}
  */
 
  buscarTicketsPorPlacaEPeriodo(placa, inicio, fim) {
    const historico = this.historicoPorPlaca.get(placa) ?? [];
    return historico.filter(
      (ticket) => ticket.dataHoraEntrada >= inicio && ticket.dataHoraEntrada <= fim
    );
  }

  /**
    Retorna todos os tickets conhecidos (abertos e fechados, de todas as placas).
    Necessário para a persistência (TicketsCsv.salvar) e para os relatórios agregados
    da Fase 2 (valorArrecadadoPorPeriodo, top10ClientesFrequentesDoAno), que precisam
    varrer o histórico completo e não apenas o de uma placa específica.
   * @returns {TicketEstacionamento[]}
  */

  todosOsTickets() {
    const fechados = [];
    for (const ticketsDaPlaca of this.historicoPorPlaca.values()) {
      fechados.push(...ticketsDaPlaca);
    }
    const abertos = Array.from(this.ticketsAbertos.values());
    return [...fechados, ...abertos];
  }
}

module.exports = RegistroDeEntradas_E_Saidas;