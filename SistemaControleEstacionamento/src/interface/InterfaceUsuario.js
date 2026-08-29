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
          continuar = false;
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
    const placa = (await this.rl.question('Placa: ')).trim();
    const recusaStr = (await this.rl.question('Houve recusa de pagamento? (s/n, só relevante para avulso): '))
      .trim()
      .toLowerCase();

    try {
      const ticket = this.app.processarSaida(placa, { pagamentoRecusado: recusaStr === 's' });
      console.log('✅ Saída processada:');
      console.log(`   Entrada: ${ticket.dataHoraEntrada.toLocaleString()}`);
      console.log(`   Saída:   ${ticket.dataHoraSaida.toLocaleString()}`);
      console.log(`   Custo original: ${ticket.custoOriginal}`);
      console.log(`   Desconto (${ticket.descontoId}): ${ticket.valorDesconto}`);
      console.log(`   Valor devido: ${ticket.valorDevido}`);
      console.log(`   Valor pago: ${ticket.valorPago}`);
    } catch (erro) {
      console.log(`❌ Erro ao processar saída: ${erro.message}`);
    }
  }

  /**
   * @private
  */

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
