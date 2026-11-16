const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor, criarCaminhos } = require('../server');

const configuracaoValida = {
  versao: 1,
  nome: 'Estacionamento API',
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
};

async function requisitar(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: {
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opcoes.headers ?? {}),
    },
  });
  const tipo = resposta.headers.get('content-type') ?? '';
  const dados = tipo.includes('application/json') ? await resposta.json() : await resposta.text();
  return { resposta, dados };
}

async function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-api-'));
  const caminhoConfiguracao = path.join(diretorio, 'config', 'estacionamento.json');
  const caminhos = criarCaminhos(diretorio);
  const instancia = criarServidor({
    diretorioDados: diretorio,
    caminhoConfiguracao,
    configuracao: null,
  });
  const servidor = instancia.httpApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  try {
    const pagina = await requisitar(baseUrl, '/');
    assert.equal(pagina.resposta.status, 200);
    assert.match(pagina.dados, /POLTOSI PIXEL PARK/);
    console.log('✅ Servidor entrega os arquivos estáticos da pasta public/.');

    const health = await requisitar(baseUrl, '/api/health');
    assert.equal(health.resposta.status, 200);
    assert.equal(health.dados.status, 'ok');
    assert.equal(health.dados.configuracaoNecessaria, true);

    const configVazia = await requisitar(baseUrl, '/api/configuracao');
    assert.equal(configVazia.dados.configuracao, null);
    console.log('✅ Health check e estado de primeira execução estão disponíveis.');

    const configInvalida = await requisitar(baseUrl, '/api/configuracao', {
      method: 'PUT',
      body: JSON.stringify({ ...configuracaoValida, capacidadeTotal: 5 }),
    });
    assert.equal(configInvalida.resposta.status, 400);
    assert.equal(configInvalida.dados.erro.codigo, 'VALIDACAO');

    const configSalva = await requisitar(baseUrl, '/api/configuracao', {
      method: 'PUT',
      body: JSON.stringify(configuracaoValida),
    });
    assert.equal(configSalva.resposta.status, 200);
    assert.equal(configSalva.dados.configuracao.nome, 'Estacionamento API');
    assert.ok(fs.existsSync(caminhoConfiguracao));
    console.log('✅ API valida e persiste a configuração inicial antes de ativar as vagas.');

    const cliente = await requisitar(baseUrl, '/api/clientes', {
      method: 'POST',
      body: JSON.stringify({
        tipo: 'estudante',
        documento: '11111111111',
        nome: 'Ana API',
        saldo: 50,
      }),
    });
    assert.equal(cliente.resposta.status, 201);
    assert.equal(cliente.dados.cliente.categoriaId, 'estudante');

    const veiculo = await requisitar(baseUrl, '/api/clientes/11111111111/veiculos', {
      method: 'POST',
      body: JSON.stringify({
        placa: 'WEB1A23',
        tipo: 'compacto',
        cor: '#4477BB',
      }),
    });
    assert.equal(veiculo.resposta.status, 201);
    assert.equal(veiculo.dados.veiculo.tipo, 'compacto');
    assert.equal(veiculo.dados.veiculo.cor, '#4477BB');

    const clientes = await requisitar(baseUrl, '/api/clientes');
    assert.equal(clientes.dados.total, 1);
    const clienteDetalhe = await requisitar(baseUrl, '/api/clientes/11111111111');
    assert.equal(clienteDetalhe.dados.cliente.veiculos[0].placa, 'WEB1A23');
    console.log('✅ Cadastro de clientes/veículos e consultas GET reutilizam a fachada App.');

    const estado = await requisitar(baseUrl, '/api/estado');
    assert.equal(estado.dados.capacidadeTotal, 4);
    assert.equal(estado.dados.vagas.livres, 4);
    const vagas = await requisitar(baseUrl, '/api/vagas?status=livre');
    assert.equal(vagas.dados.vagas.length, 4);

    const entrada = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'WEB1A23' }),
    });
    assert.equal(entrada.resposta.status, 201);
    assert.equal(entrada.dados.ticket.vagaId, 'GERAL-001');

    const estacionados = await requisitar(baseUrl, '/api/veiculos/estacionados');
    assert.equal(estacionados.dados.total, 1);
    assert.equal(estacionados.dados.veiculos[0].placa, 'WEB1A23');
    assert.equal(estacionados.dados.veiculos[0].tipoVeiculo, 'compacto');

    const entradaDuplicada = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'WEB1A23' }),
    });
    assert.equal(entradaDuplicada.resposta.status, 409);
    assert.equal(entradaDuplicada.dados.erro.codigo, 'CONFLITO');
    console.log('✅ Entradas da API alocam vagas reais e os conflitos retornam HTTP 409.');

    const reconfigurarOcupado = await requisitar(baseUrl, '/api/configuracao', {
      method: 'PUT',
      body: JSON.stringify({ ...configuracaoValida, nome: 'Outro nome' }),
    });
    assert.equal(reconfigurarOcupado.resposta.status, 200);
    assert.equal(reconfigurarOcupado.dados.veiculosPreservados, 1);
    const vagaPreservada = await requisitar(baseUrl, '/api/vagas?status=ocupada');
    assert.equal(vagaPreservada.dados.vagas[0].id, 'GERAL-001');
    assert.equal(vagaPreservada.dados.vagas[0].placa, 'WEB1A23');
    console.log('✅ Reconfiguração compatível mantém o veículo estacionado na mesma vaga.');

    const configuracaoIncompativel = {
      ...configuracaoValida,
      nome: 'Configuração incompatível',
      categorias: [{
        id: 'estudante',
        nome: 'Estudante',
        quantidade: 4,
        cor: '#4D91D1',
        criteriosElegibilidade: { categoriasCliente: ['estudante'] },
      }],
      perfisCliente: [{
        ...configuracaoValida.perfisCliente[0],
        categoriasVagaPermitidas: ['*'],
      }],
    };
    const tentativaIncompativel = await requisitar(baseUrl, '/api/configuracao', {
      method: 'PUT',
      body: JSON.stringify(configuracaoIncompativel),
    });
    assert.equal(tentativaIncompativel.resposta.status, 409);
    const configuracaoAtiva = await requisitar(baseUrl, '/api/configuracao');
    assert.equal(configuracaoAtiva.dados.configuracao.nome, 'Outro nome');
    assert.equal((await requisitar(baseUrl, '/api/vagas?status=ocupada')).dados.vagas[0].id, 'GERAL-001');
    console.log('✅ Reconfiguração incompatível é recusada sem substituir a configuração ou perder a ocupação.');

    const saida = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'WEB1A23' }),
    });
    assert.equal(saida.resposta.status, 200);
    assert.equal(saida.dados.ticket.valorPago, 15);
    assert.equal((await requisitar(baseUrl, '/api/veiculos/estacionados')).dados.total, 0);
    console.log('✅ Saídas HTTP chamam a regra de domínio e liberam a vaga associada ao ticket.');

    const bloqueio = await requisitar(baseUrl, '/api/vagas/GERAL-002/bloquear', { method: 'POST' });
    assert.equal(bloqueio.resposta.status, 200);
    assert.equal(bloqueio.dados.vaga.status, 'bloqueada');

    const reconfigurarComBloqueio = await requisitar(baseUrl, '/api/configuracao', {
      method: 'PUT',
      body: JSON.stringify({ ...configuracaoValida, nome: 'Configuração com bloqueio preservado' }),
    });
    assert.equal(reconfigurarComBloqueio.resposta.status, 200);
    const bloqueiosPreservados = await requisitar(baseUrl, '/api/vagas?status=bloqueada');
    assert.equal(bloqueiosPreservados.dados.vagas[0].id, 'GERAL-002');

    const desbloqueio = await requisitar(baseUrl, '/api/vagas/GERAL-002/desbloquear', { method: 'POST' });
    assert.equal(desbloqueio.resposta.status, 200);
    assert.equal(desbloqueio.dados.vaga.status, 'livre');

    const eventos = await requisitar(baseUrl, '/api/eventos?origem=api&limite=100');
    assert.equal(eventos.resposta.status, 200);
    assert.ok(eventos.dados.total >= 6);
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'ENTRADA_AUTORIZADA'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'SAIDA_CONCLUIDA'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'VAGA_BLOQUEADA'));
    console.log('✅ Eventos gerados pela API são persistidos e consultáveis por origem.');

    const clienteAusente = await requisitar(baseUrl, '/api/clientes/inexistente');
    assert.equal(clienteAusente.resposta.status, 404);
    const campoAusente = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assert.equal(campoAusente.resposta.status, 400);
    const rotaAusente = await requisitar(baseUrl, '/api/rota-que-nao-existe');
    assert.equal(rotaAusente.resposta.status, 404);
    console.log('✅ Erros de validação, recursos ausentes e rotas desconhecidas usam respostas HTTP padronizadas.');

    const geracao = await requisitar(baseUrl, '/api/clientes/gerar', {
      method: 'POST',
      body: JSON.stringify({
        quantidade: 2,
        categoriaId: 'estudante',
        tipoVeiculo: 'motocicleta',
        coresVeiculo: ['#D94B4B'],
      }),
    });
    assert.equal(geracao.resposta.status, 201);
    assert.equal(geracao.dados.criados, 2);
    assert.ok(geracao.dados.clientes.every((cliente) => cliente.veiculos[0].tipo === 'motocicleta'));
    assert.equal(instancia.estacionamento.registroDeEntradasESaidas.ticketsAbertos.size, 0);
    assert.equal((await requisitar(baseUrl, '/api/eventos?tipo=CLIENTE_GERADO&origem=api')).dados.total, 2);
    console.log('✅ Endpoint HTTP gera lote de clientes/veículos sem registrar entrada automática.');

    instancia.estacionamento.salvarTudo(caminhos);
    const appRestaurado = criarServidor({
      diretorioDados: diretorio,
      caminhoConfiguracao,
    });
    assert.equal(appRestaurado.estacionamento.registroEventos.consultar({ tipo: 'ENTRADA_AUTORIZADA' }).total, 1);
    assert.equal(appRestaurado.estacionamento.buscarClientePorDocumento('11111111111').nome, 'Ana API');
    console.log('✅ Configuração, dados do domínio e eventos sobrevivem ao encerramento/reinicialização.');
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

executar().catch((erro) => {
  console.error('❌ Teste da API HTTP falhou:', erro);
  process.exitCode = 1;
});
