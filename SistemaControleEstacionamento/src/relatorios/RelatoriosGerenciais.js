const Estudante = require('../clientes/Estudante');
const Professor = require('../clientes/Professor');
const Empresa = require('../clientes/Empresa');

/*
    Relatórios gerenciais — implementação completa (Fase 2).

    Convenções adotadas (nenhuma delas altera regra de negócio, só decide
    "como agregar/apresentar" o que já existe em CadastroClientes e
    RegistroDeEntradas_E_Saidas):

    - "Categoria de cliente" para valorArrecadadoPorPeriodo/top10: uma das
      strings 'Estudante' | 'Professor' | 'Empresa' | 'Avulso'.
    - "Valor arrecadado" = soma de valorPago (o que efetivamente entrou no
      caixa), não valorDevido (que pode divergir em caso de recusa de
      pagamento ou saldo negativo).
    - O período de valorArrecadadoPorPeriodo/registrosCliente* filtra pela
      data de SAÍDA do ticket (é quando o valor é efetivamente apurado);
      tickets ainda abertos nunca entram nesses relatórios.
    - "Frequência" (top10ClientesFrequentesDoAno) conta tickets cuja
      dataHoraEntrada caiu no ano informado, abertos ou fechados.
*/

const CATEGORIAS_VALIDAS = ['Estudante', 'Professor', 'Empresa', 'Avulso'];

class RelatoriosGerenciais {
  /**
   * @param {import('../clientes/CadastroClientes')} cadastroClientes
   * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registroDeEntradasESaidas
   */

  constructor(cadastroClientes, registroDeEntradasESaidas) {
    this.cadastroClientes = cadastroClientes;
    this.registro = registroDeEntradasESaidas;
  }

  /**
    Determina a categoria textual de um cliente (ou 'Avulso' se null).
   * @param {import('../clientes/Cliente')|null} cliente
   * @returns {string}
   * @private
  */

  _categoriaDoCliente(cliente) {
    if (cliente instanceof Estudante) return 'Estudante';
    if (cliente instanceof Professor) return 'Professor';
    if (cliente instanceof Empresa) return 'Empresa';
    return 'Avulso';
  }

  /**
   * Soma valores pagos no período (filtrando pela data de saída do ticket),
   * opcionalmente restringindo a uma categoria de cliente.
   * @param {Date} inicio
   * @param {Date} fim
   * @param {string} [categoria] 'Estudante' | 'Professor' | 'Empresa' | 'Avulso'
   * @returns {{ inicio: Date, fim: Date, categoria: string, valorTotal: number, quantidadeTickets: number }}
   */

  valorArrecadadoPorPeriodo(inicio, fim, categoria) {
    if (categoria != null && !CATEGORIAS_VALIDAS.includes(categoria)) {
      throw new Error(
        `categoria inválida: "${categoria}" (esperado um de ${CATEGORIAS_VALIDAS.join(', ')})`
      );
    }

    let valorTotal = 0;
    let quantidadeTickets = 0;

    for (const ticket of this.registro.todosOsTickets()) {
      if (ticket.estaAberto()) continue;
      if (ticket.dataHoraSaida < inicio || ticket.dataHoraSaida > fim) continue;

      const cliente = this.cadastroClientes.buscarClientePorPlaca(ticket.placa);
      const categoriaDoTicket = this._categoriaDoCliente(cliente);
      if (categoria != null && categoriaDoTicket !== categoria) continue;

      valorTotal += ticket.valorPago ?? 0;
      quantidadeTickets += 1;
    }

    return {
      inicio,
      fim,
      categoria: categoria ?? 'todas',
      valorTotal: Math.round(valorTotal * 100) / 100,
      quantidadeTickets,
    };
  }

  /**
   * Situação cadastral/financeira do cliente: placas atualmente estacionadas,
   * saldo/débito conforme o tipo, e se está impedido de entrar.
   * @param {string} documento
   */

  situacaoCliente(documento) {
    const cliente = this.cadastroClientes.buscarClientePorDocumento(documento);
    if (!cliente) {
      throw new Error(`cliente não encontrado para o documento "${documento}"`);
    }

    const placasEstacionadas = Array.from(cliente.placas.keys()).filter((placa) =>
      this.registro.veiculoEstaDentro(placa)
    );

    const situacao = {
      documento: cliente.documento,
      nome: cliente.nome,
      tipo: this._categoriaDoCliente(cliente),
      placas: Array.from(cliente.placas.keys()),
      placasEstacionadas,
      impedidoDeEntrar: !cliente.podeAutorizarEntrada({ ticketsAbertos: this.registro.ticketsAbertos }),
    };

    if (cliente instanceof Estudante) {
      situacao.saldo = cliente.saldo;
    } else if (cliente instanceof Empresa) {
      situacao.saldoDevedor = cliente.saldoDevedor;
      situacao.inadimplente = cliente.inadimplente;
    }

    return situacao;
  }

  /**
    Tickets de um cliente cadastrado no período (todas as suas placas).
   * @param {string} documento
   * @param {Date} inicio
   * @param {Date} fim
   */

  registrosClienteCadastrado(documento, inicio, fim) {
    const cliente = this.cadastroClientes.buscarClientePorDocumento(documento);
    if (!cliente) {
      throw new Error(`cliente não encontrado para o documento "${documento}"`);
    }

    const registros = [];
    for (const placa of cliente.placas.keys()) {
      registros.push(...this.registro.buscarTicketsPorPlacaEPeriodo(placa, inicio, fim));
    }

    registros.sort((a, b) => a.dataHoraEntrada - b.dataHoraEntrada);

    return {
      documento: cliente.documento,
      nome: cliente.nome,
      inicio,
      fim,
      tickets: registros,
    };
  }

  /**
    Tickets de uma placa avulsa (não cadastrada) no período.
   * @param {string} placa
   * @param {Date} inicio
   * @param {Date} fim
   */

  registrosClienteNaoCadastrado(placa, inicio, fim) {
    const cliente = this.cadastroClientes.buscarClientePorPlaca(placa);
    if (cliente) {
      throw new Error(
        `a placa "${placa}" pertence a um cliente cadastrado (${cliente.nome}) — use registrosClienteCadastrado`
      );
    }

    const tickets = this.registro.buscarTicketsPorPlacaEPeriodo(placa, inicio, fim);
    return { placa, inicio, fim, tickets };
  }

  /**
    Clientes impedidos de entrar: cadastrados bloqueados (saldo negativo,
    inadimplência, ou professor com veículo já dentro) + placas avulsas
    bloqueadas por recusa de pagamento.
   */

  clientesImpedidos() {
    const cadastradosBloqueados = this.cadastroClientes.listarBloqueados().map((cliente) => ({
      documento: cliente.documento,
      nome: cliente.nome,
      tipo: this._categoriaDoCliente(cliente),
    }));

    return {
      clientesCadastradosBloqueados: cadastradosBloqueados,
      placasAvulsasBloqueadas: Array.from(this.registro.placasBloqueadas),
    };
  }

  /**
    Ranking dos 10 clientes com mais usos no ano informado.
    Agrupa por documento (cadastrado) ou por placa (avulso); conta tickets
    cuja dataHoraEntrada caiu no ano informado, abertos ou fechados.
   * @param {number} ano
   */

  top10ClientesFrequentesDoAno(ano) {
    const inicioAno = new Date(ano, 0, 1, 0, 0, 0, 0);
    const fimAno = new Date(ano, 11, 31, 23, 59, 59, 999);

    /** @type {Map<string, { identificador: string, nome: string|null, tipo: string, quantidadeUsos: number, placas: Set<string> }>} */
    const agregados = new Map();

    for (const ticket of this.registro.todosOsTickets()) {
      if (ticket.dataHoraEntrada < inicioAno || ticket.dataHoraEntrada > fimAno) continue;

      const cliente = this.cadastroClientes.buscarClientePorPlaca(ticket.placa);
      const chave = cliente ? cliente.documento : ticket.placa;

      if (!agregados.has(chave)) {
        agregados.set(chave, {
          identificador: chave,
          nome: cliente ? cliente.nome : null,
          tipo: this._categoriaDoCliente(cliente),
          quantidadeUsos: 0,
          placas: new Set(),
        });
      }

      const agregado = agregados.get(chave);
      agregado.quantidadeUsos += 1;
      agregado.placas.add(ticket.placa);
    }

    return Array.from(agregados.values())
      .sort((a, b) => b.quantidadeUsos - a.quantidadeUsos)
      .slice(0, 10)
      .map((agregado) => ({ ...agregado, placas: Array.from(agregado.placas) }));
  }
}

module.exports = RelatoriosGerenciais;
