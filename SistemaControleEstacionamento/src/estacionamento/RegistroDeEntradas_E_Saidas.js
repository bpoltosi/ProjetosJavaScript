const TicketEstacionamento = require('./TicketEstacionamento');
const ClienteAvulso = require('../clientes/ClienteAvulso');
const DescontoClienteFrequente = require('../descontos/DescontoClienteFrequente');
const Estudante = require('../clientes/Estudante');
const Professor = require('../clientes/Professor');
const Empresa = require('../clientes/Empresa');

/*
  Orquestra entradas, saídas, capacidade, bloqueio de avulsos e descontos.
  O registro de eventos é opcional para preservar compatibilidade com usos
  antigos da classe fora da aplicação principal.
*/
class RegistroDeEntradas_E_Saidas {
  static CAPACIDADE_TOTAL = 9000;

  constructor(cadastroClientes, gerenciadorVagas = null, registroEventos = null) {
    this.cadastroClientes = cadastroClientes;
    this.gerenciadorVagas = gerenciadorVagas;
    this.registroEventos = registroEventos;
    this.descontosDisponiveis = [new DescontoClienteFrequente()];
    this.ticketsAbertos = new Map();
    this.historicoPorPlaca = new Map();
    this.placasBloqueadas = new Set();
  }

  possuiVagaDisponivel() {
    if (this.gerenciadorVagas) return this.gerenciadorVagas.temVagaDisponivel();
    return this.ticketsAbertos.size < RegistroDeEntradas_E_Saidas.CAPACIDADE_TOTAL;
  }

  veiculoEstaDentro(placa) {
    return this.ticketsAbertos.has(placa);
  }

  _contextoEvento(placa, cliente, veiculo, vaga, origem, dados = {}) {
    return {
      placa,
      tipoVeiculo: veiculo?.tipo ?? null,
      corVeiculo: veiculo?.cor ?? null,
      categoriaCliente: cliente?.categoriaId ?? null,
      vagaId: vaga?.id ?? null,
      origem,
      ...dados,
    };
  }

  _registrarEventos(eventos) {
    if (!this.registroEventos) return;
    try {
      this.registroEventos.registrarVarios(eventos);
    } catch (erro) {
      erro.eventoRegistroFalhou = true;
      throw erro;
    }
  }

  _registrarNegacao(evento) {
    try {
      this._registrarEventos([evento]);
    } catch (erroRegistro) {
      // A falha no log não deve esconder a recusa original nem alterar o domínio.
      return erroRegistro;
    }
    return null;
  }

  autorizarEntrada(placa, opcoes = {}) {
    const origem = opcoes.origem ?? 'manual';
    let cliente = null;
    let veiculo = null;

    try {
      if (typeof placa === 'string' && placa.trim() !== '') {
        cliente = this.cadastroClientes.buscarClientePorPlaca(placa.trim().toUpperCase());
        const clienteVeiculo = cliente ?? (this.gerenciadorVagas ? new ClienteAvulso(placa) : null);
        veiculo = clienteVeiculo?.placas.get(placa.trim().toUpperCase()) ?? null;
        if (!cliente) cliente = clienteVeiculo;
      }

      if (this.placasBloqueadas.has(placa)) {
        throw new Error('placa bloqueada');
      }
      if (this.veiculoEstaDentro(placa)) {
        throw new Error('veículo já está dentro do estacionamento');
      }
      if (!this.possuiVagaDisponivel()) {
        throw new Error('estacionamento lotado');
      }

      const clienteCadastrado = this.cadastroClientes.buscarClientePorPlaca(placa);
      if (clienteCadastrado instanceof Empresa &&
          !clienteCadastrado.inadimplente &&
          clienteCadastrado.dataVencimentoBoleto !== null &&
          clienteCadastrado.saldoDevedor > 0 &&
          new Date() > clienteCadastrado.dataVencimentoBoleto) {
        this._registrarEventos([{
          tipo: 'CLIENTE_BLOQUEADO',
          resultado: 'bloqueado',
          placa,
          categoriaCliente: clienteCadastrado.categoriaId,
          origem,
          motivo: 'Boleto vencido com saldo devedor pendente.',
          detalhes: `Empresa ${clienteCadastrado.nome} bloqueada por inadimplência.`,
        }]);
      }
      if (clienteCadastrado) {
        const autorizado = clienteCadastrado.podeAutorizarEntrada({
          ticketsAbertos: this.ticketsAbertos,
        });
        if (!autorizado) {
          throw new Error('entrada não autorizada para este cliente');
        }
      }

      const clienteParaAlocacao = clienteCadastrado ??
        (this.gerenciadorVagas ? new ClienteAvulso(placa) : null);
      veiculo = clienteParaAlocacao?.placas.get(placa) ?? null;
      const vaga = this.gerenciadorVagas
        ? this.gerenciadorVagas.alocar(placa, clienteParaAlocacao, veiculo)
        : null;
      const ticket = new TicketEstacionamento(placa, new Date(), vaga?.id ?? null);

      try {
        const dadosEvento = this._contextoEvento(
          placa,
          clienteParaAlocacao,
          veiculo,
          vaga,
          origem,
          { resultado: 'autorizado' }
        );
        const eventos = [{
          ...dadosEvento,
          tipo: 'ENTRADA_AUTORIZADA',
          detalhes: 'Entrada autorizada e ticket criado.',
        }];
        if (vaga) {
          eventos.push({
            ...dadosEvento,
            tipo: 'VAGA_ALOCADA',
            resultado: 'ocupada',
            detalhes: `Vaga ${vaga.id} alocada ao veículo.`,
          });
        }
        this._registrarEventos(eventos);
      } catch (erroRegistro) {
        if (vaga && this.gerenciadorVagas) {
          this.gerenciadorVagas.liberarPorPlaca(placa);
        }
        throw erroRegistro;
      }

      // Commit do estado operacional ocorre somente após persistir o evento.
      this.ticketsAbertos.set(placa, ticket);
      if (clienteCadastrado && 'placaAtualEstacionada' in clienteCadastrado) {
        clienteCadastrado.placaAtualEstacionada = placa;
      }
      return ticket;
    } catch (erro) {
      if (!erro.eventoRegistroFalhou) {
        const clienteContexto = cliente ??
          this.cadastroClientes.buscarClientePorPlaca(
            typeof placa === 'string' ? placa.trim().toUpperCase() : placa
          );
        const veiculoContexto = veiculo ??
          clienteContexto?.placas.get(typeof placa === 'string' ? placa.trim().toUpperCase() : placa);
        this._registrarNegacao({
          ...this._contextoEvento(placa, clienteContexto, veiculoContexto, null, origem, {
            resultado: 'negado',
            motivo: erro.message,
            detalhes: 'Tentativa de entrada recusada pelo backend.',
          }),
          tipo: 'ENTRADA_NEGADA',
        });
      }
      throw erro;
    }
  }

  processarSaida(placa, opcoes = {}) {
    const origem = opcoes.origem ?? 'manual';
    const ticket = this.ticketsAbertos.get(placa);
    const clienteCadastrado = this.cadastroClientes.buscarClientePorPlaca(placa);
    const clienteContexto = clienteCadastrado ??
      (ticket && this.gerenciadorVagas ? new ClienteAvulso(placa) : null);
    const veiculo = clienteCadastrado?.placas.get(placa) ??
      (clienteContexto instanceof ClienteAvulso ? clienteContexto.placas.get(placa) : null);

    if (!ticket) {
      const erro = new Error('veículo não está registrado como dentro');
      this._registrarNegacao({
        ...this._contextoEvento(placa, clienteContexto, veiculo, null, origem, {
          resultado: 'negado',
          motivo: erro.message,
          detalhes: 'Tentativa de saída recusada: não existe ticket aberto para a placa.',
        }),
        tipo: 'SAIDA_NEGADA',
      });
      throw erro;
    }

    const dataHoraSaida = new Date();
    if (opcoes.pagamentoRecusado === true && clienteCadastrado) {
      const erro = new Error('recusa de pagamento não se aplica a clientes cadastrados; a cobrança é feita por saldo, boleto ou gratuidade');
      this._registrarNegacao({
        ...this._contextoEvento(placa, clienteContexto, veiculo,
          this.gerenciadorVagas?.buscarPorPlaca(placa) ?? null,
          origem, {
            resultado: 'negado',
            motivo: erro.message,
            detalhes: 'Saída mantida em aberto porque clientes cadastrados não pagam na cancela.',
          }),
        tipo: 'SAIDA_NEGADA',
      });
      throw erro;
    }
    let custoOriginal;
    let descontoId = 'nenhum';
    let valorDesconto = 0;
    let valorPago;
    let registrarDebito = false;
    let debitarSaldo = false;
    let pagamentoRecusado = false;
    let saldoEstudanteProjetado = null;
    let debitoEmpresaProjetado = null;
    let politicaCobranca = 'avulso-pagamento-na-saida';

    if (clienteCadastrado) {
      custoOriginal = clienteCadastrado.calcularCusto(ticket.dataHoraEntrada, dataHoraSaida);
      valorPago = custoOriginal;
      debitarSaldo = typeof clienteCadastrado.debitar === 'function';
      registrarDebito = typeof clienteCadastrado.registrarDebito === 'function';

      if (clienteCadastrado instanceof Estudante) {
        politicaCobranca = 'debito-em-saldo';
        saldoEstudanteProjetado = clienteCadastrado.saldo - custoOriginal;
      } else if (clienteCadastrado instanceof Empresa) {
        politicaCobranca = 'debito-para-boleto';
        debitoEmpresaProjetado = clienteCadastrado.saldoDevedor + custoOriginal;
        // Empresa acumula um débito para boleto; nenhum valor é pago na cancela.
        valorPago = 0;
      } else if (clienteCadastrado instanceof Professor) {
        politicaCobranca = 'gratuito';
      } else {
        politicaCobranca = 'perfil-personalizado-gratuito';
      }
    } else {
      const historico = this.buscarTicketsPorPlacaEPeriodo(
        placa,
        new Date(0),
        dataHoraSaida
      );
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
      pagamentoRecusado = opcoes.pagamentoRecusado === true;
      valorPago = pagamentoRecusado ? 0 : valorDevido;
    }

    const vagaOcupada = this.gerenciadorVagas?.buscarPorPlaca(placa) ?? null;
    const vagaId = ticket.vagaId ?? vagaOcupada?.id ?? null;
    const resultado = pagamentoRecusado ? 'recusado' : 'concluido';
    const dadosEvento = this._contextoEvento(
      placa,
      clienteContexto,
      veiculo,
      vagaOcupada,
      origem,
      {
        vagaId,
        resultado,
        detalhes: pagamentoRecusado
          ? `Saída registrada com pagamento recusado. Valor devido: ${custoOriginal - valorDesconto}.`
          : `Saída processada. Valor pago: ${valorPago}.`,
      }
    );
    dadosEvento.detalhes = pagamentoRecusado
      ? `Pagamento recusado. Valor devido: ${custoOriginal - valorDesconto}; placa será bloqueada.`
      : `Política de cobrança: ${politicaCobranca}. Valor devido: ${custoOriginal - valorDesconto}; valor pago na saída: ${valorPago}.`;

    const eventos = [{
      ...dadosEvento,
      tipo: pagamentoRecusado ? 'SAIDA_PAGAMENTO_RECUSADO' : 'SAIDA_CONCLUIDA',
      motivo: pagamentoRecusado ? 'Pagamento recusado pelo cliente.' : null,
    }];
    if (saldoEstudanteProjetado !== null && saldoEstudanteProjetado < 0 && clienteCadastrado.saldo >= 0) {
      eventos.push({
        ...dadosEvento,
        tipo: 'CLIENTE_BLOQUEADO',
        resultado: 'bloqueado',
        motivo: 'Saldo pré-pago insuficiente após a cobrança da permanência.',
        detalhes: `Estudante ${clienteCadastrado.nome} ficou com saldo ${saldoEstudanteProjetado.toFixed(2)} e não poderá fazer novas entradas até recarga.`,
      });
    }
    if (debitoEmpresaProjetado !== null) {
      eventos.push({
        ...dadosEvento,
        tipo: 'DEBITO_EMPRESA_REGISTRADO',
        resultado: 'pendente',
        detalhes: `Débito de ${custoOriginal.toFixed(2)} adicionado ao saldo da empresa. Total pendente: ${debitoEmpresaProjetado.toFixed(2)}.`,
      });
    }
    if (vagaId) {
      eventos.push({
        ...dadosEvento,
        tipo: 'VAGA_LIBERADA',
        resultado: 'livre',
        detalhes: `Vaga ${vagaId} liberada após a saída.`,
      });
    }
    if (pagamentoRecusado) {
      eventos.push({
        ...dadosEvento,
        tipo: 'PLACA_BLOQUEADA',
        resultado: 'bloqueada',
        motivo: 'Pagamento recusado.',
        detalhes: 'Placa bloqueada para novas entradas até regularização.',
      });
    }

    // Persistir o evento (ou o lote de eventos) precede qualquer mutação do ticket,
    // saldo do cliente, bloqueios ou ocupação de vaga.
    this._registrarEventos(eventos);

    if (debitarSaldo) clienteCadastrado.debitar(custoOriginal);
    if (registrarDebito) clienteCadastrado.registrarDebito(custoOriginal);
    if (pagamentoRecusado) this.placasBloqueadas.add(placa);

    ticket.fecharSaida({
      dataHoraSaida,
      custoOriginal,
      descontoId,
      valorDesconto,
      valorPago,
    });
    this.ticketsAbertos.delete(placa);
    if (clienteCadastrado && 'placaAtualEstacionada' in clienteCadastrado) {
      clienteCadastrado.placaAtualEstacionada = null;
    }
    if (this.gerenciadorVagas) this.gerenciadorVagas.liberarPorPlaca(placa);

    if (!this.historicoPorPlaca.has(placa)) {
      this.historicoPorPlaca.set(placa, []);
    }
    this.historicoPorPlaca.get(placa).push(ticket);
    return ticket;
  }

  buscarTicketsPorPlacaEPeriodo(placa, inicio, fim) {
    const historico = this.historicoPorPlaca.get(placa) ?? [];
    return historico.filter(
      (ticket) => ticket.dataHoraEntrada >= inicio && ticket.dataHoraEntrada <= fim
    );
  }

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
