const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const ConfiguracaoEstacionamento = require('../src/configuracao/ConfiguracaoEstacionamento');

function criarConfiguracao() {
  return new ConfiguracaoEstacionamento({
    versao: 1,
    nome: 'Estacionamento de Teste',
    capacidadeTotal: 3,
    categorias: [
      {
        id: 'estudante',
        nome: 'Estudante',
        quantidade: 1,
        cor: '#4477BB',
        criteriosElegibilidade: { categoriasCliente: ['estudante'] },
        tiposVeiculoPermitidos: ['sedan', 'compacto'],
      },
      {
        id: 'acessivel',
        nome: 'Acessível',
        quantidade: 1,
        cor: '#D66F78',
        criteriosElegibilidade: { categoriasCliente: ['estudante'], requerAcessibilidade: true },
        tiposVeiculoPermitidos: ['sedan', 'compacto'],
      },
      {
        id: 'geral',
        nome: 'Geral',
        quantidade: 1,
        cor: '#65A878',
        criteriosElegibilidade: { categoriasCliente: ['*'] },
        tiposVeiculoPermitidos: ['sedan', 'compacto'],
      },
    ],
    perfisCliente: [
      {
        id: 'estudante',
        nome: 'Estudante',
        classeDominio: 'estudante',
        limitePlacas: 1,
        categoriasVagaPermitidas: ['estudante', 'acessivel', 'geral'],
      },
    ],
  });
}

function criarCaminhos(diretorio) {
  return {
    clientes: path.join(diretorio, 'clientes.csv'),
    tickets: path.join(diretorio, 'tickets.csv'),
    bloqueios: path.join(diretorio, 'bloqueios.csv'),
    veiculos: path.join(diretorio, 'veiculos.json'),
    vagas: path.join(diretorio, 'estado-vagas.json'),
  };
}

function cadastrarEstudante(app, documento, nome, placa, caracteristicas = {}) {
  const estudante = new Estudante(documento, nome, 100);
  app.cadastrarCliente(estudante);
  if (caracteristicas.acessivel) estudante.definirCredencialAcessibilidade(true);
  app.registrarPlaca(documento, placa, {
    tipo: caracteristicas.tipo ?? 'sedan',
    cor: caracteristicas.cor ?? '#4477BB',
  });
  return estudante;
}

function executar() {
  const configuracao = criarConfiguracao();
  const app = new App(configuracao);

  assert.equal(app.resumoVagas().total, 3);
  assert.equal(app.resumoVagas().livres, 3);
  assert.equal(app.listarVagas().length, 3);
  assert.deepEqual(app.listarVagas({ categoriaId: 'estudante' }).map((vaga) => vaga.id), ['ESTUDANTE-001']);
  console.log('✅ O gerenciador cria uma vaga identificada para cada vaga configurada.');

  cadastrarEstudante(app, '10000000001', 'Estudante Um', 'ABC1D23');
  const ticketUm = app.autorizarEntrada('ABC1D23');
  assert.equal(ticketUm.vagaId, 'ESTUDANTE-001');
  assert.equal(app.gerenciadorVagas.buscarPorPlaca('ABC1D23').status, 'ocupada');
  console.log('✅ Entrada aloca uma vaga da categoria permitida e associa o ID ao ticket.');

  cadastrarEstudante(app, '10000000002', 'Estudante Acessível', 'DEF4G56', { acessivel: true });
  const ticketDois = app.autorizarEntrada('DEF4G56');
  assert.equal(ticketDois.vagaId, 'ACESSIVEL-001');
  assert.equal(app.gerenciadorVagas.buscarPorPlaca('DEF4G56').categoriaId, 'acessivel');
  console.log('✅ A credencial de acessibilidade é respeitada na alocação da vaga.');

  cadastrarEstudante(app, '10000000003', 'Estudante Três', 'GHI7J89');
  const ticketTres = app.autorizarEntrada('GHI7J89');
  assert.equal(ticketTres.vagaId, 'GERAL-001');
  assert.equal(app.resumoVagas().ocupadas, 3);
  assert.equal(app.resumoVagas().livres, 0);
  assert.throws(() => app.autorizarEntrada('ZXY9W87'), /estacionamento lotado/);
  console.log('✅ A alocação respeita categorias alternativas e bloqueia entradas quando todas as vagas estão ocupadas.');

  const ticketSaida = app.processarSaida('ABC1D23');
  assert.equal(ticketSaida.vagaId, 'ESTUDANTE-001');
  assert.equal(app.gerenciadorVagas.buscarPorPlaca('ABC1D23'), null);
  assert.equal(app.gerenciadorVagas.buscarPorId('ESTUDANTE-001').status, 'livre');
  assert.equal(app.resumoVagas().ocupadas, 2);
  console.log('✅ A saída libera exatamente a vaga associada ao ticket.');

  const vagaLivre = app.listarVagas({ status: 'livre' })[0];
  app.gerenciadorVagas.bloquear(vagaLivre.id);
  assert.equal(app.gerenciadorVagas.buscarPorId(vagaLivre.id).status, 'bloqueada');
  assert.throws(() => app.gerenciadorVagas.bloquear('NAO-EXISTE'), /não encontrada/);
  app.gerenciadorVagas.desbloquear(vagaLivre.id);
  assert.equal(app.gerenciadorVagas.buscarPorId(vagaLivre.id).status, 'livre');
  app.gerenciadorVagas.bloquear(vagaLivre.id);
  console.log('✅ Vagas podem ser bloqueadas/desbloqueadas sem afetar vagas ocupadas.');

  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-vagas-'));
  try {
    const caminhos = criarCaminhos(diretorio);
    app.salvarTudo(caminhos);
    const appRestaurado = new App(configuracao);
    appRestaurado.carregarTudo(caminhos);

    const ticketAberto = appRestaurado.registroDeEntradasESaidas.ticketsAbertos.get('DEF4G56');
    assert.ok(ticketAberto);
    assert.equal(ticketAberto.vagaId, 'ACESSIVEL-001');
    assert.equal(appRestaurado.gerenciadorVagas.buscarPorPlaca('DEF4G56').id, 'ACESSIVEL-001');
    assert.equal(appRestaurado.resumoVagas().ocupadas, 2);
    assert.equal(appRestaurado.gerenciadorVagas.buscarPorId(vagaLivre.id).status, 'bloqueada');
    console.log('✅ Ocupação, ID da vaga e bloqueio de manutenção são restaurados após salvar e carregar os dados.');

    const configIncompativel = new ConfiguracaoEstacionamento({
      versao: 1,
      nome: 'Estacionamento Pequeno',
      capacidadeTotal: 1,
      categorias: [{
        id: 'geral',
        nome: 'Geral',
        quantidade: 1,
        cor: '#65A878',
        criteriosElegibilidade: { categoriasCliente: ['*'] },
        tiposVeiculoPermitidos: ['sedan'],
        dimensoesMaximas: { comprimentoMetros: 4.8, larguraMetros: 1.9 },
      }],
      perfisCliente: [{
        id: 'estudante',
        nome: 'Estudante',
        classeDominio: 'estudante',
        limitePlacas: 1,
        categoriasVagaPermitidas: ['geral'],
      }],
    });
    const appIncompativel = new App(configIncompativel);
    cadastrarEstudante(appIncompativel, '10000000004', 'Estudante Micro', 'JKL1M23', { tipo: 'micro-onibus' });
    assert.throws(
      () => appIncompativel.autorizarEntrada('JKL1M23'),
      /não há vaga livre compatível/
    );
    assert.equal(appIncompativel.resumoVagas().livres, 1);
    console.log('✅ Veículos com tipo/dimensões incompatíveis são recusados sem consumir vagas.');
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste do gerenciador de vagas falhou:', erro);
  process.exitCode = 1;
}
