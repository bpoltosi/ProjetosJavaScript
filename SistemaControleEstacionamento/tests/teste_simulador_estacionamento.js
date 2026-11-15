const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const App = require('../src/App');
const { criarServidor } = require('../server');

class AgendadorFake {
  constructor() {
    this.itens = [];
    this.sequencia = 0;
  }

  setTimeout(callback, atraso) {
    const item = {
      id: ++this.sequencia,
      callback,
      atraso,
      cancelado: false,
      executado: false,
    };
    this.itens.push(item);
    return item;
  }

  clearTimeout(item) {
    if (item) item.cancelado = true;
  }

  get pendentes() {
    return this.itens.filter((item) => !item.cancelado && !item.executado);
  }

  async dispararProximo(simulador) {
    const item = this.pendentes[0];
    if (!item) return false;
    item.executado = true;
    item.callback();
    await Promise.resolve();
    if (simulador.execucaoAtual) await simulador.execucaoAtual;
    return true;
  }
}

function criarConfiguracao(capacidade = 2) {
  return {
    versao: 1,
    nome: 'Estacionamento Simulador',
    capacidadeTotal: capacidade,
    categorias: [{
      id: 'geral',
      nome: 'Geral',
      quantidade: capacidade,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
    }],
    perfisCliente: [{
      id: 'professor',
      nome: 'Professor',
      classeDominio: 'professor',
      limitePlacas: 2,
      categoriasVagaPermitidas: ['geral'],
    }],
  };
}

function criarAmbiente(capacidade = 2) {
  let instante = new Date('2026-11-15T12:00:00.000-03:00').getTime();
  const agendador = new AgendadorFake();
  const app = new App(criarConfiguracao(capacidade), {
    simulador: {
      random: () => 0,
      agora: () => new Date(instante),
      agendador,
    },
  });
  return {
    app,
    agendador,
    agora: () => new Date(instante),
    avancar(ms) { instante += ms; },
  };
}

async function testarCicloDeVidaERelogio() {
  const ambiente = criarAmbiente(2);
  const { app, agendador } = ambiente;
  const simulador = app.simulador;

  assert.equal(simulador.obterEstado().estado, 'parado');
  const inicio = ambiente.agora();
  const iniciado = simulador.iniciar({
    categoriaId: 'professor',
    quantidadeVeiculos: 2,
    velocidade: 1,
    intervaloChegadaMs: 1000,
    permanenciaMinMs: 1000,
    permanenciaMaxMs: 1000,
    probabilidadeTentativaDuplicada: 0,
  });
  assert.equal(iniciado.estado, 'executando');
  assert.equal(iniciado.veiculosNaFrota, 2);
  assert.equal(agendador.pendentes.length, 1);
  assert.equal(agendador.pendentes[0].atraso, 1000);

  await simulador.executarCiclo();
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 1);
  const primeiraPlaca = Array.from(app.registroDeEntradasESaidas.ticketsAbertos.keys())[0];
  const ticketEntrada = app.registroDeEntradasESaidas.ticketsAbertos.get(primeiraPlaca);
  assert.equal(ticketEntrada.dataHoraEntrada.getTime(), inicio.getTime());
  assert.equal(simulador.estatisticas.entradasAutorizadas, 1);

  // Duas chamadas concorrentes ao mesmo ciclo não devem duplicar a operação.
  const cicloEmCurso = simulador.executarCiclo();
  const concorrente = await simulador.executarCiclo();
  assert.equal(concorrente, false);
  await cicloEmCurso;
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 2);
  assert.equal(simulador.estatisticas.entradasAutorizadas, 2);
  console.log('✅ Chegadas executam entrada e alocação reais; o bloqueio evita ciclos concorrentes.');

  ambiente.avancar(1000);
  await simulador.executarCiclo();
  assert.equal(simulador.estatisticas.saidas, 2);
  assert.equal(app.registroDeEntradasESaidas.historicoPorPlaca.size, 2);
  for (const tickets of app.registroDeEntradasESaidas.historicoPorPlaca.values()) {
    assert.equal(tickets[0].dataHoraSaida.getTime(), ambiente.agora().getTime());
  }
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 1);
  console.log('✅ Permanência usa o relógio injetado, processa saídas e libera as vagas no tempo simulado.');

  const pausado = simulador.pausar();
  assert.equal(pausado.estado, 'pausado');
  assert.equal(agendador.pendentes.length, 0);
  const veiculosAoPausar = app.registroDeEntradasESaidas.ticketsAbertos.size;
  assert.equal(await simulador.executarCiclo(), false);
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, veiculosAoPausar);

  simulador.retomar();
  assert.equal(simulador.obterEstado().estado, 'executando');
  assert.equal(agendador.pendentes.length, 1);
  simulador.definirVelocidade(2);
  assert.equal(simulador.obterEstado().intervaloEfetivoMs, 500);
  assert.equal(agendador.pendentes.length, 1);
  assert.equal(agendador.pendentes[0].atraso, 500);
  console.log('✅ Pausar congela novos ciclos; retomar reativa o timer e 2x reduz o intervalo pela metade.');

  const encerrado = await simulador.encerrar();
  assert.equal(encerrado.estado, 'parado');
  assert.equal(encerrado.veiculosDaSimulacaoEstacionados, 0);
  assert.equal(agendador.pendentes.length, 0);
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 0);
  assert.ok(app.consultarEventos({ tipo: 'SIMULACAO_INICIADA', origem: 'simulacao' }).total === 1);
  assert.ok(app.consultarEventos({ tipo: 'SIMULACAO_PAUSADA', origem: 'simulacao' }).total === 1);
  assert.ok(app.consultarEventos({ tipo: 'SIMULACAO_RETOMADA', origem: 'simulacao' }).total === 1);
  assert.ok(app.consultarEventos({ tipo: 'SIMULACAO_ENCERRADA', origem: 'simulacao' }).total === 1);
  assert.ok(app.consultarEventos({ tipo: 'SAIDA_CONCLUIDA', origem: 'simulacao' }).total >= 3);
  console.log('✅ Encerramento limpa o timer, processa as saídas restantes e registra o ciclo de vida.');

  assert.throws(() => simulador.definirVelocidade(3), /1, 2 ou 5/);
  assert.throws(() => simulador.iniciar({ velocidade: 3 }), /1, 2 ou 5/);
  assert.throws(() => simulador.iniciar({ intervaloChegadaMs: 50 }), /entre 100 e 3600000/);
  console.log('✅ Velocidades e parâmetros fora do contrato são rejeitados.');
}

async function testarNegacaoPorLotacao() {
  const ambiente = criarAmbiente(1);
  const { app } = ambiente;
  const simulador = app.simulador;

  simulador.iniciar({
    categoriaId: 'professor',
    quantidadeVeiculos: 2,
    intervaloChegadaMs: 1000,
    permanenciaMinMs: 10000,
    permanenciaMaxMs: 10000,
    probabilidadeTentativaDuplicada: 0,
  });

  await simulador.executarCiclo();
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 1);
  await simulador.executarCiclo();
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 1);
  assert.equal(simulador.estatisticas.entradasNegadas, 1);

  const negada = app.consultarEventos({ tipo: 'ENTRADA_NEGADA', origem: 'simulacao' });
  assert.equal(negada.total, 1);
  assert.match(negada.eventos[0].motivo, /estacionamento lotado|vaga livre compatível/);
  const vagas = app.resumoVagas();
  assert.equal(vagas.ocupadas, 1);
  assert.equal(vagas.livres, 0);

  await simulador.encerrar();
  assert.equal(app.resumoVagas().ocupadas, 0);
  console.log('✅ Estacionamento lotado gera tentativa negada real e não altera o veículo já estacionado.');
}

async function testarTentativaDuplicada() {
  const ambiente = criarAmbiente(2);
  const { app } = ambiente;
  const simulador = app.simulador;

  simulador.iniciar({
    categoriaId: 'professor',
    quantidadeVeiculos: 2,
    intervaloChegadaMs: 1000,
    permanenciaMinMs: 10000,
    permanenciaMaxMs: 10000,
    probabilidadeTentativaDuplicada: 1,
  });
  await simulador.executarCiclo();
  await simulador.executarCiclo();

  assert.equal(simulador.estatisticas.entradasNegadas, 1);
  const duplicada = app.consultarEventos({ tipo: 'ENTRADA_NEGADA', origem: 'simulacao' });
  assert.equal(duplicada.total, 1);
  assert.match(duplicada.eventos[0].motivo, /já está dentro/);
  assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 2);
  await simulador.encerrar();
  console.log('✅ Leituras duplicadas são recusadas pelo domínio e registradas como eventos de simulação.');
}

async function testarInelegibilidadeFinanceira() {
  const ambiente = criarAmbiente(1);
  const { app } = ambiente;
  const simulador = app.simulador;

  simulador.iniciar({
    categoriaId: 'estudante',
    quantidadeVeiculos: 1,
    intervaloChegadaMs: 1000,
    permanenciaMinMs: 1000,
    permanenciaMaxMs: 1000,
    probabilidadeTentativaDuplicada: 0,
  });

  await simulador.executarCiclo();
  const placa = Array.from(simulador.veiculosAtivos.keys())[0];
  const cliente = app.buscarClientePorPlaca(placa);
  assert.equal(cliente.saldo, 0);
  assert.equal(app.veiculoEstaDentro(placa), true);

  ambiente.avancar(1000);
  await simulador.executarCiclo();
  assert.equal(cliente.saldo, -15);
  assert.equal(app.veiculoEstaDentro(placa), false);
  assert.equal(simulador.estatisticas.entradasNegadas, 1);

  const negada = app.consultarEventos({ tipo: 'ENTRADA_NEGADA', placa, origem: 'simulacao' });
  assert.equal(negada.total, 1);
  assert.match(negada.eventos[0].motivo, /não autorizada/);

  await simulador.encerrar();
  console.log('✅ Inelegibilidade real por saldo negativo é aplicada pelo domínio e registrada no histórico da simulação.');
}

async function testarAgendamentoAutomatico() {
  const ambiente = criarAmbiente(2);
  const simulador = ambiente.app.simulador;
  const agendador = ambiente.agendador;

  simulador.iniciar({
    categoriaId: 'professor',
    quantidadeVeiculos: 2,
    velocidade: 1,
    intervaloChegadaMs: 200,
    permanenciaMinMs: 1000,
    permanenciaMaxMs: 1000,
    probabilidadeTentativaDuplicada: 0,
  });
  assert.equal(agendador.pendentes[0].atraso, 200);
  await agendador.dispararProximo(simulador);
  assert.equal(simulador.estatisticas.entradasAutorizadas, 1);
  assert.equal(agendador.pendentes.length, 1);

  simulador.definirVelocidade(5);
  assert.equal(agendador.pendentes[0].atraso, 40);
  await simulador.encerrar();
  assert.equal(agendador.pendentes.length, 0);
  console.log('✅ O agendador recursivo mantém um único timer e escala 1x/5x de forma determinística.');
}

async function testarApiDaSimulacao() {
  const ambiente = criarAmbiente(2);
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-api-simulacao-'));
  const instancia = criarServidor({
    estacionamento: ambiente.app,
    diretorioDados: diretorio,
    caminhoConfiguracao: path.join(diretorio, 'config', 'estacionamento.json'),
  });
  const servidor = instancia.httpApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  async function requisitar(metodo, rota, corpo) {
    const resposta = await fetch(`${baseUrl}${rota}`, {
      method: metodo,
      headers: corpo ? { 'Content-Type': 'application/json' } : undefined,
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    return { status: resposta.status, dados: await resposta.json() };
  }

  try {
    const estadoInicial = await requisitar('GET', '/api/simulacao');
    assert.equal(estadoInicial.status, 200);
    assert.equal(estadoInicial.dados.estado, 'parado');

    const inicio = await requisitar('POST', '/api/simulacao/iniciar', {
      categoriaId: 'professor',
      quantidadeVeiculos: 2,
      intervaloChegadaMs: 3600000,
      permanenciaMinMs: 1000,
      permanenciaMaxMs: 1000,
      probabilidadeTentativaDuplicada: 0,
    });
    assert.equal(inicio.status, 201);
    assert.equal(inicio.dados.estado, 'executando');

    const duplicado = await requisitar('POST', '/api/simulacao/iniciar', {});
    assert.equal(duplicado.status, 409);

    const pausa = await requisitar('POST', '/api/simulacao/pausar');
    assert.equal(pausa.status, 200);
    assert.equal(pausa.dados.estado, 'pausado');

    const velocidade = await requisitar('PUT', '/api/simulacao/velocidade', { velocidade: 5 });
    assert.equal(velocidade.status, 200);
    assert.equal(velocidade.dados.velocidade, 5);

    const retomada = await requisitar('POST', '/api/simulacao/retomar');
    assert.equal(retomada.status, 200);
    assert.equal(retomada.dados.estado, 'executando');

    const encerramento = await requisitar('POST', '/api/simulacao/encerrar');
    assert.equal(encerramento.status, 200);
    assert.equal(encerramento.dados.estado, 'parado');
    assert.equal(encerramento.dados.agendamentoAtivo, false);

    const eventos = await requisitar('GET', '/api/eventos?origem=simulacao&limite=100');
    assert.equal(eventos.status, 200);
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'SIMULACAO_INICIADA'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'SIMULACAO_ENCERRADA'));
    console.log('✅ API expõe estado, iniciar, pausar, retomar, velocidade e encerramento da simulação.');
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
    await ambiente.app.encerrarSimulacao();
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

async function executar() {
  await testarCicloDeVidaERelogio();
  await testarNegacaoPorLotacao();
  await testarTentativaDuplicada();
  await testarInelegibilidadeFinanceira();
  await testarAgendamentoAutomatico();
  await testarApiDaSimulacao();
}

executar().catch((erro) => {
  console.error('❌ Teste do simulador de estacionamento falhou:', erro);
  process.exitCode = 1;
});
