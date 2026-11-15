const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor, criarCaminhos } = require('../server');

const configuracao = {
  versao: 1,
  nome: 'Estacionamento Integração Completa',
  capacidadeTotal: 6,
  categorias: [
    {
      id: 'geral',
      nome: 'Geral',
      quantidade: 4,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
      tiposVeiculoPermitidos: ['compacto', 'hatch', 'sedan', 'suv', 'van', 'motocicleta'],
    },
    {
      id: 'acessivel',
      nome: 'Acessível',
      quantidade: 2,
      cor: '#D6B35D',
      criteriosElegibilidade: { categoriasCliente: ['*'], requerAcessibilidade: true },
      tiposVeiculoPermitidos: ['compacto', 'hatch', 'sedan', 'suv', 'van'],
    },
  ],
  perfisCliente: [
    { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: ['geral', 'acessivel'] },
    { id: 'professor', nome: 'Professor', classeDominio: 'professor', limitePlacas: 2, categoriasVagaPermitidas: ['geral', 'acessivel'] },
    { id: 'empresa', nome: 'Empresa', classeDominio: 'empresa', limitePlacas: null, categoriasVagaPermitidas: ['geral'] },
  ],
};

async function iniciarHttp(instancia) {
  const servidor = instancia.httpApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  return {
    servidor,
    baseUrl: `http://127.0.0.1:${servidor.address().port}`,
  };
}

async function requisitar(baseUrl, metodo, rota, corpo) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    method: metodo,
    headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const tipo = resposta.headers.get('content-type') || '';
  const dados = tipo.includes('application/json') ? await resposta.json() : await resposta.text();
  return { status: resposta.status, dados };
}

async function executar() {
  const diretorioDados = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-e2e-completo-'));
  const caminhoConfiguracao = path.join(diretorioDados, 'config', 'estacionamento.json');
  const caminhos = criarCaminhos(diretorioDados);
  const diretorioDemo = path.join(__dirname, '..', 'data');
  const caminhoTicketsDemo = path.join(diretorioDemo, 'tickets.csv');
  const ticketsDemoAntes = fs.existsSync(caminhoTicketsDemo)
    ? fs.readFileSync(caminhoTicketsDemo, 'utf8')
    : null;
  const snapshotDadosDemo = () => {
    if (!fs.existsSync(diretorioDemo)) return null;
    return Object.fromEntries(fs.readdirSync(diretorioDemo, { withFileTypes: true })
      .filter((item) => item.isFile())
      .map((item) => [item.name, fs.readFileSync(path.join(diretorioDemo, item.name))]));
  };
  const dadosDemoAntes = snapshotDadosDemo();

  let primeiroServidor;
  let segundoServidor;

  try {
    // 1. Instalação limpa: servidor sobe sem configuração e apresenta o assistente.
    const primeiraInstancia = criarServidor({
      diretorioDados,
      caminhoConfiguracao,
      configuracao: null,
    });
    const primeiroHttp = await iniciarHttp(primeiraInstancia);
    primeiroServidor = primeiroHttp.servidor;

    const healthInicial = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/health');
    assert.equal(healthInicial.status, 200);
    assert.equal(healthInicial.dados.configuracaoNecessaria, true);

    const configInicial = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/configuracao');
    assert.equal(configInicial.dados.configuracao, null);

    const index = await fetch(`${primeiroHttp.baseUrl}/`);
    assert.equal(index.status, 200);
    assert.match(await index.text(), /PIXEL PARK/);
    console.log('✅ Instalação limpa inicia a API e entrega a página de configuração.');

    // 2. Configuração inicial passa pelo mesmo endpoint usado pelo assistente web.
    const salvamentoConfig = await requisitar(primeiroHttp.baseUrl, 'PUT', '/api/configuracao', configuracao);
    assert.equal(salvamentoConfig.status, 200);
    assert.equal(salvamentoConfig.dados.configuracao.capacidadeTotal, 6);
    assert.ok(fs.existsSync(caminhoConfiguracao));

    const estadoConfigurado = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/estado');
    assert.equal(estadoConfigurado.dados.configurado, true);
    assert.equal(estadoConfigurado.dados.vagas.total, 6);
    assert.equal(estadoConfigurado.dados.vagas.livres, 6);
    console.log('✅ Configuração validada e seis vagas reais foram criadas pelo backend.');

    // 3. Cadastro do cliente e veículo; metadados persistentes.
    const cliente = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/clientes', {
      tipo: 'estudante',
      documento: '10020030040',
      nome: 'Cliente Integração',
      saldo: 60,
    });
    assert.equal(cliente.status, 201);

    const veiculo = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/clientes/10020030040/veiculos', {
      placa: 'E2E1A23',
      tipo: 'compacto',
      cor: '#4477BB',
    });
    assert.equal(veiculo.status, 201);
    assert.equal(veiculo.dados.veiculo.tipo, 'compacto');
    assert.equal(veiculo.dados.veiculo.cor, '#4477BB');

    // 4. Entrada autoriza no domínio e aloca uma vaga que aparece no mapa/API.
    const entrada = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/entradas', { placa: 'E2E1A23' });
    assert.equal(entrada.status, 201);
    const vagaAlocada = entrada.dados.vaga.id;
    assert.equal(entrada.dados.ticket.placa, 'E2E1A23');

    const vagasOcupadas = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/vagas?status=ocupada');
    assert.equal(vagasOcupadas.dados.vagas.length, 1);
    assert.equal(vagasOcupadas.dados.vagas[0].id, vagaAlocada);
    assert.equal(vagasOcupadas.dados.vagas[0].placa, 'E2E1A23');

    const estacionados = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/veiculos/estacionados');
    assert.equal(estacionados.dados.total, 1);
    assert.equal(estacionados.dados.veiculos[0].tipoVeiculo, 'compacto');
    assert.equal(estacionados.dados.veiculos[0].corVeiculo, '#4477BB');
    assert.equal(estacionados.dados.veiculos[0].vagaId, vagaAlocada);
    console.log('✅ Cadastro, entrada, ticket e mapa apontam para o mesmo veículo e a mesma vaga.');

    // 5. Saída usa a política de estudante: débito no saldo, sem pagamento na cancela.
    const saida = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/saidas', { placa: 'E2E1A23' });
    assert.equal(saida.status, 200);
    assert.equal(saida.dados.cobranca.politica, 'debito-em-saldo');
    assert.equal(saida.dados.cobranca.valorDebitado, 15);
    assert.equal(saida.dados.cobranca.saldoAtual, 45);
    assert.equal(saida.dados.cobranca.bloqueado, false);

    const vagasLivres = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/vagas?status=livre');
    assert.equal(vagasLivres.dados.vagas.length, 6);
    const estadoAposSaida = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/estado');
    assert.equal(estadoAposSaida.dados.veiculosEstacionados, 0);
    console.log('✅ Saída debita o saldo, fecha o ticket e libera a vaga no estado geral e na listagem.');

    // 6. Geração é separada de entrada; eventos e metadados passam pelo backend.
    const geracao = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/clientes/gerar', {
      quantidade: 2,
      categoriaId: 'professor',
      tipoVeiculo: 'van',
      coresVeiculo: ['#B75E50'],
    });
    assert.equal(geracao.status, 201);
    assert.equal(geracao.dados.criados, 2);
    assert.equal(primeiraInstancia.estacionamento.registroDeEntradasESaidas.ticketsAbertos.size, 0);

    // 7. Bloqueio físico de uma vaga persiste no estado das vagas.
    const bloqueio = await requisitar(primeiroHttp.baseUrl, 'POST', '/api/vagas/GERAL-004/bloquear');
    assert.equal(bloqueio.status, 200);
    assert.equal(bloqueio.dados.vaga.status, 'bloqueada');

    const terminal = await requisitar(primeiroHttp.baseUrl, 'GET', '/api/eventos?limite=200');
    assert.ok(terminal.dados.eventos.some((evento) => evento.tipo === 'ENTRADA_AUTORIZADA' && evento.placa === 'E2E1A23'));
    assert.ok(terminal.dados.eventos.some((evento) => evento.tipo === 'SAIDA_CONCLUIDA' && evento.placa === 'E2E1A23'));
    assert.ok(terminal.dados.eventos.some((evento) => evento.tipo === 'VAGA_LIBERADA' && evento.placa === 'E2E1A23'));
    assert.ok(terminal.dados.eventos.some((evento) => evento.tipo === 'CLIENTE_GERADO' && evento.origem === 'api'));
    assert.ok(terminal.dados.eventos.some((evento) => evento.tipo === 'VAGA_BLOQUEADA' && evento.vagaId === 'GERAL-004'));

    // 8. Simula encerramento normal e reinício: todos os dados usam o mesmo diretório.
    primeiraInstancia.estacionamento.salvarTudo(caminhos);
    await new Promise((resolve) => primeiroServidor.close(resolve));
    primeiroServidor = null;

    const segundaInstancia = criarServidor({ diretorioDados, caminhoConfiguracao });
    const segundoHttp = await iniciarHttp(segundaInstancia);
    segundoServidor = segundoHttp.servidor;

    const healthRestaurado = await requisitar(segundoHttp.baseUrl, 'GET', '/api/health');
    assert.equal(healthRestaurado.dados.configuracaoNecessaria, false);

    const estadoRestaurado = await requisitar(segundoHttp.baseUrl, 'GET', '/api/estado');
    assert.equal(estadoRestaurado.dados.nomeEstacionamento, configuracao.nome);
    assert.equal(estadoRestaurado.dados.vagas.bloqueadas, 1);
    assert.equal(estadoRestaurado.dados.veiculosEstacionados, 0);

    const clientesRestaurados = await requisitar(segundoHttp.baseUrl, 'GET', '/api/clientes');
    assert.equal(clientesRestaurados.dados.total, 3);
    const estudanteRestaurado = await requisitar(segundoHttp.baseUrl, 'GET', '/api/clientes/10020030040');
    assert.equal(estudanteRestaurado.dados.cliente.saldo, 45);
    assert.equal(estudanteRestaurado.dados.cliente.veiculos[0].tipo, 'compacto');
    assert.equal(estudanteRestaurado.dados.cliente.veiculos[0].cor, '#4477BB');

    const eventosRestaurados = await requisitar(segundoHttp.baseUrl, 'GET', '/api/eventos?limite=200');
    assert.equal(eventosRestaurados.dados.total, terminal.dados.total);
    assert.ok(eventosRestaurados.dados.eventos.some((evento) => evento.tipo === 'SAIDA_CONCLUIDA' && evento.placa === 'E2E1A23'));

    const vagasBloqueadas = await requisitar(segundoHttp.baseUrl, 'GET', '/api/vagas?status=bloqueada');
    assert.equal(vagasBloqueadas.dados.vagas.length, 1);
    assert.equal(vagasBloqueadas.dados.vagas[0].id, 'GERAL-004');
    console.log('✅ Reinicialização restaura configuração, clientes, saldo, metadados, bloqueios e histórico de eventos.');

    // 9. Os dados de demonstração originais não foram utilizados pela execução isolada.
    if (ticketsDemoAntes !== null) {
      assert.equal(fs.readFileSync(caminhoTicketsDemo, 'utf8'), ticketsDemoAntes);
    }
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.equal(packageJson.scripts.start, 'node main.js');
    assert.equal(packageJson.scripts.web, 'node server.js');
    const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.js'), 'utf8');
    const serverSource = fs.readFileSync(path.join(__dirname, '..', 'server.js'), 'utf8');
    assert.ok(mainSource.includes('process.env.ESTACIONAMENTO_DIR_DADOS'));
    assert.ok(mainSource.includes('process.env.ESTACIONAMENTO_CONFIG'));
    for (const arquivo of ['clientes.csv', 'tickets.csv', 'bloqueios.csv', 'veiculos.json', 'estado-vagas.json', 'eventos.jsonl']) {
      assert.ok(mainSource.includes(\`'\${arquivo}'\`), `CLI deve usar ${arquivo}`);
      assert.ok(serverSource.includes(\`'\${arquivo}'\`), `servidor web deve usar ${arquivo}`);
    }
    assert.deepEqual(snapshotDadosDemo(), dadosDemoAntes, 'nenhum arquivo de demonstração pode ser alterado pelo teste');
    assert.equal(ticketsDemoAntes === null || fs.readFileSync(caminhoTicketsDemo, 'utf8') === ticketsDemoAntes, true);
    console.log('✅ CLI e web usam a mesma convenção de arquivos, e os dados de demonstração permanecem intactos.');
  } finally {
    if (primeiroServidor) await new Promise((resolve) => primeiroServidor.close(resolve));
    if (segundoServidor) await new Promise((resolve) => segundoServidor.close(resolve));
    fs.rmSync(diretorioDados, { recursive: true, force: true });
  }
}

executar().catch((erro) => {
  console.error('❌ Teste de integração ponta a ponta falhou:', erro);
  process.exitCode = 1;
});
