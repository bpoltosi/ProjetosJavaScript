const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const Professor = require('../src/clientes/Professor');
const Empresa = require('../src/clientes/Empresa');
const ClientePersonalizado = require('../src/clientes/ClientePersonalizado');

function criarConfiguracao() {
  return {
    versao: 1,
    nome: 'Estacionamento Operações',
    capacidadeTotal: 8,
    categorias: [{
      id: 'geral',
      nome: 'Geral',
      quantidade: 8,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
    }],
    perfisCliente: [
      { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: ['geral'] },
      { id: 'professor', nome: 'Professor', classeDominio: 'professor', limitePlacas: 2, categoriasVagaPermitidas: ['geral'] },
      { id: 'empresa', nome: 'Empresa', classeDominio: 'empresa', limitePlacas: null, categoriasVagaPermitidas: ['geral'] },
      { id: 'funcionario', nome: 'Funcionário', classeDominio: 'personalizado', limitePlacas: 2, categoriasVagaPermitidas: ['geral'] },
    ],
  };
}

function criarCaminhos(diretorio) {
  return {
    clientes: path.join(diretorio, 'clientes.csv'),
    tickets: path.join(diretorio, 'tickets.csv'),
    bloqueios: path.join(diretorio, 'bloqueios.csv'),
    veiculos: path.join(diretorio, 'veiculos.json'),
    vagas: path.join(diretorio, 'estado-vagas.json'),
    eventos: path.join(diretorio, 'eventos.jsonl'),
  };
}

function adicionarVeiculo(app, cliente, placa, tipo = 'sedan') {
  app.cadastrarCliente(cliente);
  app.registrarPlaca(cliente.documento, placa, { tipo, cor: '#4477BB' });
}

function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-operacoes-'));
  try {
    const configuracao = criarConfiguracao();
    const caminhos = criarCaminhos(diretorio);
    const app = new App(configuracao);
    app.carregarTudo(caminhos);

    // Estudante: débito no saldo pré-pago; saldo negativo bloqueia novas entradas.
    const estudante = new Estudante('11111111111', 'Ana Estudante', 5);
    adicionarVeiculo(app, estudante, 'EST1A23');
    app.autorizarEntrada('EST1A23');
    const saidaEstudante = app.processarSaida('EST1A23');
    assert.equal(saidaEstudante.custoOriginal, 15);
    assert.equal(estudante.saldo, -10);
    assert.equal(estudante.inadimplente, undefined);
    assert.equal(app.consultarEventos({ tipo: 'CLIENTE_BLOQUEADO', placa: 'EST1A23' }).total, 1);
    assert.throws(() => app.autorizarEntrada('EST1A23'), /não autorizada/);
    assert.equal(app.veiculoEstaDentro('EST1A23'), false);
    assert.equal(app.consultarEventos({ tipo: 'ENTRADA_NEGADA', placa: 'EST1A23' }).total, 1);
    console.log('✅ Estudante debita saldo e fica impedido de entrar quando o saldo se torna negativo.');

    const recarga = app.carregarSaldo(estudante.documento, 20);
    assert.equal(recarga.saldoAnterior, -10);
    assert.equal(recarga.saldoAtual, 10);
    assert.equal(recarga.bloqueado, false);
    assert.equal(app.consultarEventos({ tipo: 'CLIENTE_DESBLOQUEADO', placa: 'EST1A23' }).total, 0);
    assert.equal(app.consultarEventos({ tipo: 'CLIENTE_DESBLOQUEADO' }).total, 1);
    app.autorizarEntrada('EST1A23');
    const saldoAntesDaRecusa = estudante.saldo;
    assert.throws(
      () => app.processarSaida('EST1A23', { pagamentoRecusado: true }),
      /não se aplica a clientes cadastrados/
    );
    assert.equal(app.veiculoEstaDentro('EST1A23'), true);
    assert.equal(estudante.saldo, saldoAntesDaRecusa);
    assert.equal(app.resumoVagas().ocupadas, 1);
    assert.equal(app.consultarEventos({ tipo: 'SAIDA_NEGADA', placa: 'EST1A23' }).total, 1);
    const saidaNormal = app.processarSaida('EST1A23');
    assert.equal(saidaNormal.valorPago, 15);
    assert.equal(estudante.saldo, -5);
    console.log('✅ Recusa de pagamento é negada para estudante sem fechar ticket nem debitar saldo; saída normal debita o valor devido.');

    // Empresa: acumula débito para boleto e fica inadimplente após o vencimento.
    const empresa = new Empresa('22222222000122', 'Empresa Parceira');
    adicionarVeiculo(app, empresa, 'EMP1A23');
    app.autorizarEntrada('EMP1A23');
    const saidaEmpresa = app.processarSaida('EMP1A23');
    assert.equal(saidaEmpresa.custoOriginal, 80);
    assert.equal(saidaEmpresa.valorDevido, 80);
    assert.equal(saidaEmpresa.valorPago, 0);
    assert.equal(empresa.saldoDevedor, 80);
    assert.equal(app.consultarEventos({ tipo: 'DEBITO_EMPRESA_REGISTRADO', placa: 'EMP1A23' }).total, 1);

    const boleto = app.emitirBoleto(empresa.documento, new Date(Date.now() - 60_000));
    assert.equal(boleto.saldoDevedor, 80);
    assert.ok(boleto.dataVencimentoBoleto);
    assert.throws(() => app.autorizarEntrada('EMP1A23'), /não autorizada/);
    assert.equal(empresa.inadimplente, true);
    assert.equal(app.consultarEventos({ tipo: 'CLIENTE_BLOQUEADO', placa: 'EMP1A23' }).total, 1);

    const quitacao = app.quitarBoleto(empresa.documento);
    assert.equal(quitacao.valorQuitado, 80);
    assert.equal(empresa.saldoDevedor, 0);
    assert.equal(empresa.inadimplente, false);
    assert.equal(empresa.dataVencimentoBoleto, null);
    assert.equal(app.consultarEventos({ tipo: 'BOLETO_EMITIDO', categoriaCliente: 'empresa' }).total, 1);
    assert.equal(app.consultarEventos({ tipo: 'BOLETO_QUITADO', categoriaCliente: 'empresa' }).total, 1);
    assert.ok(app.consultarEventos({ tipo: 'CLIENTE_DESBLOQUEADO' }).total >= 2);
    assert.doesNotThrow(() => app.autorizarEntrada('EMP1A23'));
    console.log('✅ Empresa acumula débito em boleto, bloqueia após vencimento e é liberada após quitação.');

    // Professor: permanência gratuita; pagamento na saída não é uma opção.
    const professor = new Professor('33333333333', 'Bruno Professor');
    adicionarVeiculo(app, professor, 'PRO1A23');
    app.autorizarEntrada('PRO1A23');
    assert.throws(() => app.processarSaida('PRO1A23', { pagamentoRecusado: true }), /não se aplica/);
    assert.equal(app.veiculoEstaDentro('PRO1A23'), true);
    const saidaProfessor = app.processarSaida('PRO1A23');
    assert.equal(saidaProfessor.custoOriginal, 0);
    assert.equal(saidaProfessor.valorDevido, 0);
    assert.equal(saidaProfessor.valorPago, 0);
    console.log('✅ Professor permanece gratuito e não pode recusar um pagamento inexistente.');

    // Perfil personalizado: até que exista política configurável, opera como gratuito.
    const perfilFuncionario = configuracao.perfisCliente.find((perfil) => perfil.id === 'funcionario');
    const funcionario = new ClientePersonalizado('44444444444', 'Carlos Funcionário', perfilFuncionario);
    adicionarVeiculo(app, funcionario, 'FUN1A23');
    app.autorizarEntrada('FUN1A23');
    assert.throws(() => app.processarSaida('FUN1A23', { pagamentoRecusado: true }), /não se aplica/);
    const saidaFuncionario = app.processarSaida('FUN1A23');
    assert.equal(saidaFuncionario.valorDevido, 0);
    assert.equal(saidaFuncionario.valorPago, 0);
    console.log('✅ Perfil personalizado segue sua política gratuita padrão e não oferece recusa de pagamento.');

    // Avulso: pagamento na saída; a recusa bloqueia a placa até regularização.
    app.autorizarEntrada('AVU1A23');
    const saidaAvulsoRecusada = app.processarSaida('AVU1A23', { pagamentoRecusado: true });
    assert.ok(saidaAvulsoRecusada.valorDevido > 0);
    assert.equal(saidaAvulsoRecusada.valorPago, 0);
    assert.equal(app.registroDeEntradasESaidas.placasBloqueadas.has('AVU1A23'), true);
    assert.throws(() => app.autorizarEntrada('AVU1A23'), /placa bloqueada/);
    assert.equal(app.consultarEventos({ tipo: 'PLACA_BLOQUEADA', placa: 'AVU1A23' }).total, 1);
    const desbloqueio = app.desbloquearPlaca('AVU1A23');
    assert.equal(desbloqueio.bloqueada, false);
    assert.equal(app.registroDeEntradasESaidas.placasBloqueadas.has('AVU1A23'), false);
    app.autorizarEntrada('AVU1A23');
    const saidaAvulsoPaga = app.processarSaida('AVU1A23');
    assert.equal(saidaAvulsoPaga.valorPago, saidaAvulsoPaga.valorDevido);
    assert.equal(app.consultarEventos({ tipo: 'PLACA_DESBLOQUEADA', placa: 'AVU1A23' }).total, 1);
    console.log('✅ Avulso paga na saída; recusa bloqueia a placa e a regularização permite nova entrada.');

    // Estados financeiros e eventos permanecem após reinicialização.
    app.salvarTudo(caminhos);
    const restaurado = new App(configuracao);
    restaurado.carregarTudo(caminhos);
    assert.equal(restaurado.buscarClientePorDocumento(estudante.documento).saldo, -5);
    assert.equal(restaurado.buscarClientePorDocumento(empresa.documento).saldoDevedor, 0);
    assert.equal(restaurado.buscarClientePorDocumento(empresa.documento).dataVencimentoBoleto, null);
    assert.equal(restaurado.registroEventos.totalEventos(), app.registroEventos.totalEventos());
    assert.equal(restaurado.registroDeEntradasESaidas.placasBloqueadas.has('AVU1A23'), false);
    console.log('✅ Saldo, débito, boleto, bloqueios e eventos são preservados após reinicialização.');

    assert.throws(() => app.carregarSaldo(empresa.documento, 10), /somente clientes estudantes/);
    assert.throws(() => app.carregarSaldo(estudante.documento, -1), /número positivo/);
    assert.throws(() => app.emitirBoleto(estudante.documento, new Date()), /somente clientes do tipo empresa/);
    assert.throws(() => app.quitarBoleto(empresa.documento), /não existe boleto pendente/);
    assert.throws(() => app.desbloquearPlaca('NO1NE23'), /não está bloqueada/);
    console.log('✅ Operações financeiras validam categoria, valor e estado antes de alterar os dados.');
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste de operações/exceções falhou:', erro);
  process.exitCode = 1;
}
