/*
    Relatórios gerenciais (Fase1-Fase2)
    A lógica completa fica para a Fase 2.
 */

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
   * Soma valores pagos no período, opcionalmente filtrando por categoria de cliente.
   * @param {Date} inicio
   * @param {Date} fim
   * @param {string} [categoria]
   */

  valorArrecadadoPorPeriodo(inicio, fim, categoria) {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }

  /**
   * Situação cadastral/financeira do cliente (saldo, inadimplência, bloqueio).
   * @param {string} documento
   */

  situacaoCliente(documento) {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }

  /**
    Tickets de um cliente cadastrado no período.
   * @param {string} documento
   * @param {Date} inicio
   * @param {Date} fim
   */

  registrosClienteCadastrado(documento, inicio, fim) {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }

  /**
    Tickets de uma placa avulsa no período.
   * @param {string} placa
   * @param {Date} inicio
   * @param {Date} fim
   */

  registrosClienteNaoCadastrado(placa, inicio, fim) {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }

  /**
    Clientes impedidos de entrar (saldo negativo, inadimplência, etc.).
   */

  clientesImpedidos() {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }

  /**
    Ranking dos 10 clientes com mais usos no ano informado.
   * @param {number} ano
   */
  
  top10ClientesFrequentesDoAno(ano) {
    throw new Error('Relatório ainda não implementado — previsto para a Fase 2');
  }
}

module.exports = RelatoriosGerenciais;