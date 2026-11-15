const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const ConfiguracaoEstacionamento = require('../src/configuracao/ConfiguracaoEstacionamento');
const RegistroEventos = require('../src/estacionamento/RegistroEventos');

function criarConfiguracao() {
  return new ConfiguracaoEstacionamento({
    versao: 1,
    nome: 'Estacionamento Eventos',
    capacidadeTotal: 4,
    categorias: [{
      id: 'geral',
      nome: 'Geral',
      quantidade: 4,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
    }],
    perfisCliente: [{
      id: 'estudante',
      nome: 'Estudante',
      classeDominio: 'estudante',
      limitePlacas: 1,
      categoriasVagaPermitidas: ['geral'],
    }],
  });
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

function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-eventos-'));
  try {
    const configuracao = criarConfiguracao();
    const caminhos = criarCaminhos(diretorio);
    const app = new App(configuracao);
    app.carregarTudo(caminhos);

    const estudante = new Estudante('11111111111', 'Ana Eventos', 100);
    app.cadastrarCliente(estudante);
    app.registrarPlaca(estudante.documento, 'EVT1A23', {
      tipo: 'compacto',
      cor: '#4477BB',
    });

    const ticket = app.autorizarEntrada('EVT1A23', { origem: 'manual' });
    assert.equal(ticket.vagaId, 'GERAL-001');
    assert.equal(app.veiculoEstaDentro('EVT1A23'), true);

    const entrada = app.consultarEventos({ tipo: 'ENTRADA_AUTORIZADA', placa: 'evt1a23' });
    assert.equal(entrada.total, 1);
    assert.equal(entrada.eventos[0].resultado, 'autorizado');
    assert.equal(entrada.eventos[0].tipoVeiculo, 'compacto');
    assert.equal(entrada.eventos[0].corVeiculo, '#4477BB');
    assert.equal(entrada.eventos[0].categoriaCliente, 'estudante');
    assert.equal(entrada.eventos[0].vagaId, 'GERAL-001');
    console.log('✅ Entrada autorizada registra placa, cliente, veículo, vaga, origem e resultado.');

    assert.throws(() => app.autorizarEntrada('EVT1A23'), /já está dentro/);
    const negada = app.consultarEventos({ tipo: 'ENTRADA_NEGADA', placa: 'EVT1A23' });
    assert.equal(negada.total, 1);
    assert.match(negada.eventos[0].motivo, /já está dentro/);
    console.log('✅ Tentativa de entrada negada é registrada com o motivo mesmo sem novo ticket.');

    const saida = app.processarSaida('EVT1A23', { origem: 'api' });
    assert.equal(saida.dataHoraSaida instanceof Date, true);
    assert.equal(app.veiculoEstaDentro('EVT1A23'), false);
    assert.equal(app.consultarEventos({ tipo: 'SAIDA_CONCLUIDA', origem: 'api' }).total, 1);
    assert.equal(app.consultarEventos({ tipo: 'VAGA_LIBERADA' }).total, 1);
    console.log('✅ Saída bem-sucedida e liberação da vaga são registradas com origem API.');

    app.autorizarEntrada('AVU1B23', { origem: 'simulacao' });
    const saidaRecusada = app.processarSaida('AVU1B23', {
      pagamentoRecusado: true,
      origem: 'simulacao',
    });
    assert.equal(saidaRecusada.valorPago, 0);
    assert.equal(app.registroDeEntradasESaidas.placasBloqueadas.has('AVU1B23'), true);
    assert.equal(app.consultarEventos({ tipo: 'SAIDA_PAGAMENTO_RECUSADO', origem: 'simulacao' }).total, 1);
    assert.equal(app.consultarEventos({ tipo: 'PLACA_BLOQUEADA', placa: 'AVU1B23' }).total, 1);
    assert.throws(() => app.autorizarEntrada('AVU1B23'), /placa bloqueada/);
    assert.equal(app.consultarEventos({ tipo: 'ENTRADA_NEGADA', placa: 'AVU1B23' }).total, 1);
    console.log('✅ Pagamento recusado, bloqueio de placa e nova tentativa barrada geram eventos reais.');

    app.bloquearVaga('GERAL-002');
    app.desbloquearVaga('GERAL-002');
    assert.equal(app.consultarEventos({ tipo: 'VAGA_BLOQUEADA' }).total, 1);
    assert.equal(app.consultarEventos({ tipo: 'VAGA_DESBLOQUEADA' }).total, 1);
    console.log('✅ Bloqueio e desbloqueio de vaga são registrados.');

    const pagina = app.consultarEventos({ pagina: 1, limite: 2 });
    assert.equal(pagina.eventos.length, 2);
    assert.ok(pagina.total > 2);
    assert.equal(pagina.pagina, 1);
    assert.ok(pagina.totalPaginas > 1);
    assert.throws(() => app.consultarEventos({ limite: 201 }), /entre 1 e 200/);
    assert.throws(() => app.consultarEventos({ desde: 'data-invalida' }), /data inválida/);
    console.log('✅ Consulta ordenada oferece filtros, paginação e limites seguros.');

    app.salvarTudo(caminhos);
    const appRestaurado = new App(configuracao);
    appRestaurado.carregarTudo(caminhos);
    assert.equal(appRestaurado.registroEventos.totalEventos(), app.registroEventos.totalEventos());
    assert.equal(appRestaurado.consultarEventos({ tipo: 'SAIDA_PAGAMENTO_RECUSADO' }).total, 1);
    const linhasJsonl = fs.readFileSync(caminhos.eventos, 'utf8').trim().split('\n');
    assert.equal(linhasJsonl.length, app.registroEventos.totalEventos());
    assert.ok(linhasJsonl.every((linha) => JSON.parse(linha).id));
    console.log('✅ Histórico JSONL é append-only, válido e restaurado após reinicialização.');

    const diretorioFalha = path.join(diretorio, 'caminho-que-e-diretorio');
    fs.mkdirSync(diretorioFalha);
    const appComFalha = new App(configuracao);
    const clienteTeste = new Estudante('22222222222', 'Cliente Transação', 100);
    appComFalha.cadastrarCliente(clienteTeste);
    appComFalha.registrarPlaca(clienteTeste.documento, 'TRN1C23');
    appComFalha.registroEventos.caminho = diretorioFalha;

    assert.throws(() => appComFalha.autorizarEntrada('TRN1C23'));
    assert.equal(appComFalha.veiculoEstaDentro('TRN1C23'), false);
    assert.equal(appComFalha.resumoVagas().ocupadas, 0);
    assert.equal(appComFalha.resumoVagas().livres, 4);
    console.log('✅ Falha ao gravar evento de entrada reverte a reserva e não cria ticket.');

    const appSaidaFalha = new App(configuracao);
    const clienteSaida = new Estudante('33333333333', 'Cliente Saída', 100);
    appSaidaFalha.cadastrarCliente(clienteSaida);
    appSaidaFalha.registrarPlaca(clienteSaida.documento, 'TRN2D34');
    appSaidaFalha.autorizarEntrada('TRN2D34');
    const saldoAntes = clienteSaida.saldo;
    appSaidaFalha.registroEventos.caminho = diretorioFalha;

    assert.throws(() => appSaidaFalha.processarSaida('TRN2D34'));
    assert.equal(appSaidaFalha.veiculoEstaDentro('TRN2D34'), true);
    assert.equal(clienteSaida.saldo, saldoAntes);
    assert.equal(appSaidaFalha.resumoVagas().ocupadas, 1);
    console.log('✅ Falha ao gravar evento de saída mantém ticket, saldo e vaga inalterados.');

    const leitor = new RegistroEventos(caminhos.eventos);
    assert.equal(leitor.totalEventos(), app.registroEventos.totalEventos());
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste de registro de eventos falhou:', erro);
  process.exitCode = 1;
}
