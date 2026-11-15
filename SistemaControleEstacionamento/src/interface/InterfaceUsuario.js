const readline = require('node:readline/promises');
const { stdin, stdout } = require('node:process');

const Estudante = require('../clientes/Estudante');
const Professor = require('../clientes/Professor');
const Empresa = require('../clientes/Empresa');

/*
    Interface textual com o usuário. Orquestra chamadas a App — não contém
    nenhuma regra de negócio (5.8). Toda exceção lançada pelo domínio é
    capturada aqui e exibida como mensagem amigável; o processo nunca cai
    por causa de uma entrada inválida do usuário (5.7).
*/

class InterfaceUsuario {
  /**
   * @param {import('../App')} app
   * @param {{ salvarAoSair?: () => void }} [opcoes]
   */

  constructor(app, opcoes = {}) {
    this.app = app;
    this.salvarAoSair = opcoes.salvarAoSair ?? (() => {});
    this.rl = readline.createInterface({ input: stdin, output: stdout });
  }

  /**
    Loop principal do menu. Roda até o usuário escolher "Sair".
  */

  async iniciar() {
    console.log('\n=== Sistema de Controle de Estacionamento ===');
    let continuar = true;

    while (continuar) {
      console.log('\n--- Menu Principal ---');
      console.log('1) Cadastro de clientes');
      console.log('2) Entrada de veículo');
      console.log('3) Saída de veículo');
      console.log('4) Consultas e relatórios');
      console.log('5) Salvar dados agora');
      console.log('6) Sair');
      console.log('7) Terminal operacional (histórico de eventos)');
      console.log('8) Financeiro e regularização de bloqueios');
      console.log('9) Simulação automatizada do estacionamento');

      const opcao = (await this.rl.question('Escolha uma opção: ')).trim();

      switch (opcao) {
        case '1':
          await this._fluxoCadastro();
          break;
        case '2':
          await this._fluxoEntrada();
          break;
        case '3':
          await this._fluxoSaida();
          break;
        case '4':
          await this._submenuRelatorios();
          break;
        case '5':
          this._salvarComMensagem();
          break;
        case '6':
          await this.app.encerrarSimulacao();
          continuar = false;
          break;
        case '7':
          await this._submenuEventos();
          break;
        case '8':
          await this._submenuRegularizacao();
          break;
        case '9':
          await this._submenuSimulacao();
          break;
        default:
          console.log('Opção inválida.');
      }
    }

    this._salvarComMensagem();
    console.log('Até logo!');
    this.rl.close();
  }

  /**
   * @private
  */

  _salvarComMensagem() {
    try {
      this.salvarAoSair();
      console.log('Dados salvos com sucesso.');
    } catch (erro) {
      console.log(`❌ Não foi possível salvar os dados: ${erro.message}`);
    }
  }

  /**
    Cadastro de um novo cliente pré-cadastrado (Estudante, Professor ou Empresa)
    seguido, opcionalmente, do cadastro de uma ou mais placas.
   * @private
  */

  async _fluxoCadastro() {
    console.log('\n--- Cadastro de Cliente ---');
    console.log('1) Estudante');
    console.log('2) Professor');
    console.log('3) Empresa');
    const tipo = (await this.rl.question('Tipo de cliente: ')).trim();

    const documento = (await this.rl.question('Documento (CPF/CNPJ): ')).trim();
    const nome = (await this.rl.question('Nome: ')).trim();

    let cliente;
    try {
      if (tipo === '1') {
        const saldoStr = (await this.rl.question('Saldo inicial (padrão 0): ')).trim();
        const saldo = saldoStr === '' ? 0 : Number(saldoStr);
        cliente = new Estudante(documento, nome, saldo);
      } else if (tipo === '2') {
        cliente = new Professor(documento, nome);
      } else if (tipo === '3') {
        cliente = new Empresa(documento, nome);
      } else {
        console.log('Tipo inválido.');
        return;
      }
      this.app.cadastrarCliente(cliente);
      console.log(`Cliente "${nome}" cadastrado com sucesso.`);
    } catch (erro) {
      console.log(`❌ Erro ao cadastrar cliente: ${erro.message}`);
      return;
    }

    let cadastrarMaisPlacas = true;
    while (cadastrarMaisPlacas) {
      const resposta = (await this.rl.question('Cadastrar uma placa para este cliente? (s/n): '))
        .trim()
        .toLowerCase();
      if (resposta !== 's') {
        cadastrarMaisPlacas = false;
        break;
      }
      const placa = (await this.rl.question('Placa: ')).trim();
      try {
        this.app.registrarPlaca(documento, placa);
        console.log(`Placa "${placa}" cadastrada com sucesso.`);
      } catch (erro) {
        console.log(`❌ Erro ao cadastrar placa: ${erro.message}`);
      }
    }
  }

  /**
   * @private
  */

  async _fluxoEntrada() {
    console.log('\n--- Entrada de Veículo ---');
    const placa = (await this.rl.question('Placa: ')).trim();
    try {
      const ticket = this.app.autorizarEntrada(placa);
      console.log(`✅ Entrada autorizada para "${placa}" às ${ticket.dataHoraEntrada.toLocaleString()}.`);
    } catch (erro) {
      console.log(`❌ Entrada negada: ${erro.message}`);
    }
  }

  /**
   * @private
  */

  async _fluxoSaida() {
    console.log('\n--- Saída de Veículo ---');
    const tickets = Array.from(this.app.registroDeEntradasESaidas.ticketsAbertos.values());

    if (tickets.length > 0) {
      console.log('Veículos atualmente estacionados:');
      tickets.forEach((ticket, indice) => {
        const cliente = this.app.buscarClientePorPlaca(ticket.placa);
        const veiculo = cliente?.placas.get(ticket.placa);
        console.log(`${indice + 1}) ${ticket.placa} | ${veiculo?.tipo ?? 'avulso'} | ${cliente?.categoriaId ?? 'avulso'} | ${ticket.vagaId ?? 'sem vaga'} | entrada ${ticket.dataHoraEntrada.toLocaleString()}`);
      });
    }

    const escolha = (await this.rl.question(
      tickets.length > 0
        ? 'Informe o número da lista ou a placa (0 para cancelar): '
        : 'Nenhum veículo listado. Informe a placa para localizar: '
    )).trim();
    if (escolha === '0') return;

    const indice = /^\d+$/.test(escolha) ? Number(escolha) - 1 : -1;
    const placa = indice >= 0 ? tickets[indice]?.placa : escolha.toUpperCase();
    if (!placa) {
      console.log('❌ Seleção inválida. Nenhum veículo foi alterado.');
      return;
    }

    const cliente = this.app.buscarClientePorPlaca(placa);
    let pagamentoRecusado = false;
    if (!cliente) {
      pagamentoRecusado = (await this.rl.question('Pagamento do cliente avulso será recusado? (s/n): '))
        .trim().toLowerCase() === 's';
    } else if (cliente instanceof Estudante) {
      console.log(`Cobrança: débito no saldo pré-pago (saldo atual: R$ ${cliente.saldo.toFixed(2)}).`);
    } else if (cliente instanceof Empresa) {
      console.log(`Cobrança: débito para boleto (pendente atual: R$ ${cliente.saldoDevedor.toFixed(2)}).`);
    } else if (cliente instanceof Professor) {
      console.log('Cobrança: gratuita. Não há pagamento na saída.');
    } else {
      console.log('Cobrança: perfil personalizado gratuito até existir política específica.');
    }

    try {
      const ticket = this.app.processarSaida(placa, { pagamentoRecusado });
      console.log('✅ Saída processada:');
      console.log(`   Entrada: ${ticket.dataHoraEntrada.toLocaleString()}`);
      console.log(`   Saída:   ${ticket.dataHoraSaida.toLocaleString()}`);
      console.log(`   Custo original: R$ ${ticket.custoOriginal.toFixed(2)}`);
      console.log(`   Desconto (${ticket.descontoId}): R$ ${ticket.valorDesconto.toFixed(2)}`);
      console.log(`   Valor devido: R$ ${ticket.valorDevido.toFixed(2)}`);
      console.log(`   Valor pago na saída: R$ ${ticket.valorPago.toFixed(2)}`);

      if (cliente instanceof Estudante) {
        console.log(`   Saldo restante: R$ ${cliente.saldo.toFixed(2)}`);
        if (cliente.saldo < 0) console.log('⚠️ Saldo negativo: cliente bloqueado até recarga.');
      } else if (cliente instanceof Empresa) {
        console.log(`   Débito acumulado para boleto: R$ ${cliente.saldoDevedor.toFixed(2)}`);
      } else if (cliente instanceof Professor) {
        console.log('   Permanência gratuita para professor.');
      } else if (!cliente && pagamentoRecusado) {
        console.log('⚠️ Pagamento recusado: placa bloqueada até regularização.');
      }
    } catch (erro) {
      console.log(`❌ Erro ao processar saída: ${erro.message}`);
    }
  }

  async _submenuSimulacao() {
    let continuar = true;
    while (continuar) {
      const estado = this.app.estadoSimulacao();
      console.log('\n--- Simulação Automatizada ---');
      console.log(`Estado: ${estado.estado} | Velocidade: ${estado.velocidade}x | Veículos da simulação estacionados: ${estado.veiculosDaSimulacaoEstacionados}`);
      console.log(`Chegadas: ${estado.estatisticas.chegadas} | Entradas: ${estado.estatisticas.entradasAutorizadas} | Negadas: ${estado.estatisticas.entradasNegadas} | Saídas: ${estado.estatisticas.saidas}`);
      if (estado.ultimoErro) console.log(`Último erro: ${estado.ultimoErro}`);
      console.log('1) Iniciar simulação');
      console.log('2) Pausar');
      console.log('3) Retomar');
      console.log('4) Alterar velocidade (1x, 2x, 5x)');
      console.log('5) Encerrar simulação');
      console.log('0) Voltar ao menu principal');

      const opcao = (await this.rl.question('Escolha uma operação: ')).trim();
      try {
        switch (opcao) {
          case '0':
            continuar = false;
            break;
          case '1': {
            const velocidadeStr = (await this.rl.question('Velocidade (1, 2 ou 5; padrão 1): ')).trim();
            const intervaloStr = (await this.rl.question('Intervalo de chegada em ms (padrão 5000): ')).trim();
            const quantidadeStr = (await this.rl.question('Tamanho da frota (padrão 12): ')).trim();
            const permanenciaMinStr = (await this.rl.question('Permanência mínima em ms (padrão 8000): ')).trim();
            const permanenciaMaxStr = (await this.rl.question('Permanência máxima em ms (padrão 30000): ')).trim();
            const resultado = this.app.iniciarSimulacao({
              velocidade: velocidadeStr === '' ? 1 : Number(velocidadeStr),
              intervaloChegadaMs: intervaloStr === '' ? 5000 : Number(intervaloStr),
              quantidadeVeiculos: quantidadeStr === '' ? 12 : Number(quantidadeStr),
              permanenciaMinMs: permanenciaMinStr === '' ? 8000 : Number(permanenciaMinStr),
              permanenciaMaxMs: permanenciaMaxStr === '' ? 30000 : Number(permanenciaMaxStr),
            });
            console.log(`✅ Simulação iniciada com frota de ${resultado.veiculosNaFrota} veículo(s).`);
            break;
          }
          case '2':
            this.app.pausarSimulacao();
            console.log('⏸️ Simulação pausada. Os veículos estacionados permanecem no estacionamento.');
            break;
          case '3':
            this.app.retomarSimulacao();
            console.log('▶️ Simulação retomada.');
            break;
          case '4': {
            const velocidade = Number((await this.rl.question('Nova velocidade (1, 2 ou 5): ')).trim());
            this.app.definirVelocidadeSimulacao(velocidade);
            console.log(`✅ Velocidade atualizada para ${velocidade}x.`);
            break;
          }
          case '5': {
            const resultado = await this.app.encerrarSimulacao();
            console.log(`✅ Simulação encerrada. ${resultado.veiculosDaSimulacaoEstacionados} veículo(s) permanecem estacionados pela simulação.`);
            break;
          }
          default:
            console.log('Opção inválida.');
        }
      } catch (erro) {
        console.log(`❌ Não foi possível executar a ação: ${erro.message}`);
      }
    }
  }

  async _submenuRegularizacao() {
    let continuar = true;
    while (continuar) {
      console.log('\n--- Financeiro e Regularização ---');
      console.log('1) Recarregar saldo de estudante');
      console.log('2) Emitir boleto para empresa');
      console.log('3) Quitar boleto de empresa');
      console.log('4) Desbloquear placa avulsa após pagamento');
      console.log('0) Voltar ao menu principal');

      const opcao = (await this.rl.question('Escolha uma operação: ')).trim();
      try {
        switch (opcao) {
          case '0':
            continuar = false;
            break;
          case '1': {
            const documento = (await this.rl.question('Documento do estudante: ')).trim();
            const valor = Number((await this.rl.question('Valor da recarga (R$): ')).replace(',', '.'));
            const resultado = this.app.carregarSaldo(documento, valor);
            console.log(`✅ Recarga registrada. Saldo atual: R$ ${resultado.saldoAtual.toFixed(2)}.`);
            if (!resultado.bloqueado) console.log('Cliente está liberado para novas entradas.');
            break;
          }
          case '2': {
            const documento = (await this.rl.question('CNPJ da empresa: ')).trim();
            const data = await this._lerData('Vencimento do boleto (AAAA-MM-DD): ');
            const resultado = this.app.emitirBoleto(documento, data);
            console.log(`✅ Boleto de R$ ${resultado.saldoDevedor.toFixed(2)} emitido com vencimento em ${resultado.dataVencimentoBoleto}.`);
            break;
          }
          case '3': {
            const documento = (await this.rl.question('CNPJ da empresa: ')).trim();
            const resultado = this.app.quitarBoleto(documento);
            console.log(`✅ Boleto de R$ ${resultado.valorQuitado.toFixed(2)} quitado. Empresa liberada.`);
            break;
          }
          case '4': {
            const placa = (await this.rl.question('Placa avulsa bloqueada: ')).trim();
            this.app.desbloquearPlaca(placa);
            console.log(`✅ Placa ${placa.toUpperCase()} desbloqueada.`);
            break;
          }
          default:
            console.log('Opção inválida.');
        }
      } catch (erro) {
        console.log(`❌ Não foi possível concluir a operação: ${erro.message}`);
      }
    }
  }

  /**
   * @private
  */

  async _submenuEventos() {
    console.log('\n=== Terminal Operacional ===');
    console.log('Histórico persistente de entradas, saídas, recusas e vagas.');
    const placa = (await this.rl.question('Filtrar por placa (vazio = todas): ')).trim();
    const tipo = (await this.rl.question('Filtrar por tipo (ex.: ENTRADA_NEGADA, vazio = todos): ')).trim();

    let pagina = 1;
    let continuar = true;
    while (continuar) {
      try {
        const resultado = this.app.consultarEventos({
          placa: placa || undefined,
          tipo: tipo || undefined,
          pagina,
          limite: 30,
        });

        console.log(`\nEventos encontrados: ${resultado.total} | Página ${pagina}/${Math.max(1, resultado.totalPaginas)}`);
        if (resultado.eventos.length === 0) {
          console.log('Nenhum evento corresponde aos filtros.');
        }

        for (const evento of resultado.eventos) {
          let marcador = '[INFO]';
          if (['negado', 'recusado'].includes(evento.resultado)) marcador = '[ALERTA]';
          else if (['autorizado', 'concluido', 'ocupada'].includes(evento.resultado)) marcador = '[OK]';
          else if (evento.resultado === 'bloqueada') marcador = '[BLOQUEIO]';
          else if (['livre', 'liberada'].includes(evento.resultado)) marcador = '[LIBERADA]';

          const horario = new Date(evento.timestamp).toLocaleString();
          const placaTexto = evento.placa ?? 'sem placa';
          const vagaTexto = evento.vagaId ? ` | Vaga: ${evento.vagaId}` : '';
          const tipoVeiculo = evento.tipoVeiculo ? ` | Veículo: ${evento.tipoVeiculo}` : '';
          const categoria = evento.categoriaCliente ? ` | Categoria: ${evento.categoriaCliente}` : '';
          const contexto = evento.motivo ?? evento.detalhes ?? '';
          console.log(`${marcador} ${horario} | ${evento.tipo} | ${placaTexto}${vagaTexto}${tipoVeiculo}${categoria} | origem: ${evento.origem}`);
          if (contexto) console.log(`        ${contexto}`);
        }

        if (pagina < resultado.totalPaginas) {
          const acao = (await this.rl.question('\n[N] Próxima página | [0] Voltar: ')).trim().toLowerCase();
          if (acao === 'n') pagina += 1;
          else continuar = false;
        } else {
          await this.rl.question('\nPressione Enter para voltar ao menu principal...');
          continuar = false;
        }
      } catch (erro) {
        console.log(`❌ Não foi possível consultar o histórico: ${erro.message}`);
        continuar = false;
      }
    }
  }

  async _submenuRelatorios() {
    const relatorios = this.app.relatoriosGerenciais;
    let permanecerNoSubmenu = true;

    while (permanecerNoSubmenu) {
      console.log('\n--- Consultas e Relatórios ---');
      console.log('1) Valor arrecadado por período');
      console.log('2) Situação de um cliente cadastrado');
      console.log('3) Registros de cliente cadastrado por período');
      console.log('4) Registros de placa não cadastrada por período');
      console.log('5) Clientes impedidos de entrar');
      console.log('6) Top 10 clientes mais frequentes do ano');
      console.log('0) Voltar ao menu principal');

      const opcao = (await this.rl.question('Escolha um relatório: ')).trim();

      if (opcao === '0') {
        permanecerNoSubmenu = false;
        continue;
      }

      await this._executarRelatorio(opcao, relatorios);
    }
  }

  /**
   * @param {string} opcao
   * @param {import('../relatorios/RelatoriosGerenciais')} relatorios
   * @private
  */

  async _executarRelatorio(opcao, relatorios) {
    try {
      switch (opcao) {
        case '1': {
          const inicio = await this._lerData('Data de início (AAAA-MM-DD): ');
          const fim = await this._lerData('Data de fim (AAAA-MM-DD): ', { fimDoDia: true });
          const categoriaStr = (await this.rl.question(
            'Categoria (Estudante/Professor/Empresa/Avulso, vazio = todas): '
          )).trim();
          const resultado = relatorios.valorArrecadadoPorPeriodo(
            inicio,
            fim,
            categoriaStr === '' ? undefined : categoriaStr
          );
          console.log(resultado);
          break;
        }
        case '2': {
          const documento = (await this.rl.question('Documento do cliente: ')).trim();
          console.log(relatorios.situacaoCliente(documento));
          break;
        }
        case '3': {
          const documento = (await this.rl.question('Documento do cliente: ')).trim();
          const inicio = await this._lerData('Data de início (AAAA-MM-DD): ');
          const fim = await this._lerData('Data de fim (AAAA-MM-DD): ', { fimDoDia: true });
          console.log(relatorios.registrosClienteCadastrado(documento, inicio, fim));
          break;
        }
        case '4': {
          const placa = (await this.rl.question('Placa: ')).trim();
          const inicio = await this._lerData('Data de início (AAAA-MM-DD): ');
          const fim = await this._lerData('Data de fim (AAAA-MM-DD): ', { fimDoDia: true });
          console.log(relatorios.registrosClienteNaoCadastrado(placa, inicio, fim));
          break;
        }
        case '5':
          console.log(relatorios.clientesImpedidos());
          break;
        case '6': {
          const anoStr = (await this.rl.question('Ano: ')).trim();
          console.log(relatorios.top10ClientesFrequentesDoAno(Number(anoStr)));
          break;
        }
        default:
          console.log('Opção inválida.');
      }
    } catch (erro) {
      console.log(`❌ Erro ao gerar relatório: ${erro.message}`);
    }
  }

  /**
    Lê uma data no formato AAAA-MM-DD. Com fimDoDia=true, ajusta para o último
    instante daquele dia (23:59:59.999), útil para o fim de um período.
   * @param {string} pergunta
   * @param {{ fimDoDia?: boolean }} [opcoes]
   * @returns {Promise<Date>}
   * @private
  */

  async _lerData(pergunta, opcoes = {}) {
    const texto = (await this.rl.question(pergunta)).trim();
    const [ano, mes, dia] = texto.split('-').map(Number);
    if (!ano || !mes || !dia) {
      throw new Error(`data inválida: "${texto}" (use o formato AAAA-MM-DD)`);
    }
    if (opcoes.fimDoDia) {
      return new Date(ano, mes - 1, dia, 23, 59, 59, 999);
    }
    return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
  }
}

module.exports = InterfaceUsuario;
