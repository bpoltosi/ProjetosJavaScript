const { lerLinhas, escreverLinhas } = require('./CsvUtil');
const TicketEstacionamento = require('../estacionamento/TicketEstacionamento');
const Professor = require('../clientes/Professor');

/*
  Leitura e escrita do arquivo de tickets (abertos e fechados).

  Formato de cada linha (decisão 1.2/1.3 do roadmap Fase 2):
    placa,dataHoraEntrada,dataHoraSaida,custoOriginal,descontoId,valorDesconto,valorDevido,valorPago
  - Ticket aberto (ainda dentro do estacionamento): apenas placa e dataHoraEntrada
    preenchidos; os demais campos ficam vazios.
  - Datas são serializadas em ISO 8601 (Date.toISOString()) para não perder
    precisão nem depender de fuso na hora de reconstruir.
*/

/**
  Converte uma string ISO em Date, ou null se vazia.
 * @param {string} valor
 * @returns {Date|null}
*/

function paraData(valor) {
  if (valor == null || valor === '') {
    return null;
  }
  return new Date(valor);
}

/**
  Converte uma string em number, ou null se vazia.
 * @param {string} valor
 * @returns {number|null}
*/

function paraNumero(valor) {
  if (valor == null || valor === '') {
    return null;
  }
  return Number(valor);
}

/**
  Carrega o arquivo de tickets, populando ticketsAbertos e historicoPorPlaca do
  registro informado. Linhas sem dataHoraSaida viram tickets abertos; linhas
  completas viram tickets fechados no histórico.

  Não faz a reconstrução de placaAtualEstacionada do Professor — isso é feito
  separadamente por reconstruirEstadoDerivado, chamado pelo orquestrador de carga
  (main.js/App) depois que CadastroClientes já estiver carregado.
 * @param {string} caminho
 * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registro
*/

function carregar(caminho, registro) {
  const linhas = lerLinhas(caminho);

  for (const linha of linhas) {
    const [
      placa,
      dataHoraEntradaStr,
      dataHoraSaidaStr,
      custoOriginalStr,
      descontoId,
      valorDescontoStr,
      valorDevidoStr,
      valorPagoStr,
    ] = linha;

    const dataHoraEntrada = paraData(dataHoraEntradaStr);
    const dataHoraSaida = paraData(dataHoraSaidaStr);

    const ticket = new TicketEstacionamento(placa, dataHoraEntrada);

    if (dataHoraSaida === null) {
      registro.ticketsAbertos.set(placa, ticket);
    } else {
      ticket.fecharSaida({
        dataHoraSaida,
        custoOriginal: paraNumero(custoOriginalStr) ?? 0,
        descontoId: descontoId && descontoId !== '' ? descontoId : 'nenhum',
        valorDesconto: paraNumero(valorDescontoStr) ?? 0,
        valorPago: paraNumero(valorPagoStr) ?? 0,
      });
      // valorDevido é recalculado por fecharSaida (custoOriginal - valorDesconto);
      // o campo lido de valorDevidoStr é apenas o valor histórico gravado no CSV
      // e não precisa ser reatribuído — mantido no formato só por legibilidade externa.
      void valorDevidoStr;

      if (!registro.historicoPorPlaca.has(placa)) {
        registro.historicoPorPlaca.set(placa, []);
      }
      registro.historicoPorPlaca.get(placa).push(ticket);
    }
  }
}

/**
  Reconstrói estado derivado que não vem diretamente do CSV de tickets:
  para cada placa com ticket aberto cujo cliente cadastrado seja Professor,
  marca placaAtualEstacionada nesse professor (decisão 1.5 do roadmap Fase 2).

  Deve ser chamado depois que tanto CadastroClientes quanto os tickets já
  estiverem carregados.
 * @param {import('../clientes/CadastroClientes')} cadastroClientes
 * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registro
*/

function reconstruirEstadoDerivado(cadastroClientes, registro) {
  for (const placa of registro.ticketsAbertos.keys()) {
    const cliente = cadastroClientes.buscarClientePorPlaca(placa);
    if (cliente instanceof Professor) {
      cliente.placaAtualEstacionada = placa;
    }
  }
}

/**
  Serializa todos os tickets conhecidos (abertos + fechados, todas as placas)
  para o arquivo indicado, sobrescrevendo o conteúdo anterior.
 * @param {string} caminho
 * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registro
*/

function salvar(caminho, registro) {
  const linhas = registro.todosOsTickets().map((ticket) => {
    if (ticket.estaAberto()) {
      return [ticket.placa, ticket.dataHoraEntrada.toISOString(), '', '', '', '', '', ''];
    }
    return [
      ticket.placa,
      ticket.dataHoraEntrada.toISOString(),
      ticket.dataHoraSaida.toISOString(),
      ticket.custoOriginal,
      ticket.descontoId,
      ticket.valorDesconto,
      ticket.valorDevido,
      ticket.valorPago,
    ];
  });

  escreverLinhas(caminho, linhas);
}

module.exports = { carregar, salvar, reconstruirEstadoDerivado };
