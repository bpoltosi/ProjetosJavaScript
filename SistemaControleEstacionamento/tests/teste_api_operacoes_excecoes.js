const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor, criarCaminhos } = require('../server');

const config = {
  versao: 1,
  nome: 'Estacionamento API Financeiro',
  capacidadeTotal: 6,
  categorias: [{
    id: 'geral',
    nome: 'Geral',
    quantidade: 6,
    cor: '#65A878',
    criteriosElegibilidade: { categoriasCliente: ['*'] },
  }],
  perfisCliente: [
    { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: ['geral'] },
    { id: 'empresa', nome: 'Empresa', classeDominio: 'empresa', limitePlacas: null, categoriasVagaPermitidas: ['geral'] },
  ],
};

async function requisitar(baseUrl, rota, opcoes = {}) {
  const resposta = await fetch(`${baseUrl}${rota}`, {
    ...opcoes,
    headers: {
      ...(opcoes.body ? { 'Content-Type': 'application/json' } : {}),
      ...(opcoes.headers ?? {}),
    },
  });
  return { resposta, dados: await resposta.json() };
}

async function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-api-financeiro-'));
  const caminhos = criarCaminhos(diretorio);
  const instancia = criarServidor({
    diretorioDados: diretorio,
    caminhoConfiguracao: path.join(diretorio, 'config', 'estacionamento.json'),
    configuracao: config,
  });
  const servidor = instancia.httpApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  try {
    const estudante = await requisitar(baseUrl, '/api/clientes', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'estudante', documento: '11111111111', nome: 'Ana Financeiro', saldo: 5 }),
    });
    assert.equal(estudante.resposta.status, 201);
    await requisitar(baseUrl, '/api/clientes/11111111111/veiculos', {
      method: 'POST',
      body: JSON.stringify({ placa: 'FIN1A23', tipo: 'compacto' }),
    });

    await requisitar(baseUrl, '/api/entradas', { method: 'POST', body: JSON.stringify({ placa: 'FIN1A23' }) });
    const saidaEstudante = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'FIN1A23' }),
    });
    assert.equal(saidaEstudante.resposta.status, 200);
    assert.equal(saidaEstudante.dados.cobranca.politica, 'debito-em-saldo');
    assert.equal(saidaEstudante.dados.cobranca.saldoAtual, -10);
    assert.equal(saidaEstudante.dados.cobranca.bloqueado, true);

    const entradaBloqueada = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'FIN1A23' }),
    });
    assert.equal(entradaBloqueada.resposta.status, 409);

    const recarga = await requisitar(baseUrl, '/api/clientes/11111111111/saldo', {
      method: 'POST',
      body: JSON.stringify({ valor: 20 }),
    });
    assert.equal(recarga.resposta.status, 200);
    assert.equal(recarga.dados.saldoAtual, 10);

    await requisitar(baseUrl, '/api/entradas', { method: 'POST', body: JSON.stringify({ placa: 'FIN1A23' }) });
    const recusaEstudante = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'FIN1A23', pagamentoRecusado: true }),
    });
    assert.equal(recusaEstudante.resposta.status, 409);
    assert.equal((await requisitar(baseUrl, '/api/veiculos/estacionados')).dados.total, 1);
    const saidaEstudanteNormal = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'FIN1A23' }),
    });
    assert.equal(saidaEstudanteNormal.resposta.status, 200);
    assert.equal(saidaEstudanteNormal.dados.cobranca.saldoAtual, -5);
    console.log('✅ API aplica débito de estudante, bloqueia saldo negativo, aceita recarga e rejeita pagamento na cancela.');

    const empresa = await requisitar(baseUrl, '/api/clientes', {
      method: 'POST',
      body: JSON.stringify({ tipo: 'empresa', documento: '22222222000122', nome: 'Empresa API' }),
    });
    assert.equal(empresa.resposta.status, 201);
    await requisitar(baseUrl, '/api/clientes/22222222000122/veiculos', {
      method: 'POST',
      body: JSON.stringify({ placa: 'EMP2A34', tipo: 'sedan' }),
    });
    await requisitar(baseUrl, '/api/entradas', { method: 'POST', body: JSON.stringify({ placa: 'EMP2A34' }) });
    const saidaEmpresa = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'EMP2A34' }),
    });
    assert.equal(saidaEmpresa.dados.cobranca.politica, 'debito-para-boleto');
    assert.equal(saidaEmpresa.dados.cobranca.saldoDevedor, 80);
    assert.equal(saidaEmpresa.dados.ticket.valorPago, 0);

    const boleto = await requisitar(baseUrl, '/api/clientes/22222222000122/boleto', {
      method: 'POST',
      body: JSON.stringify({ dataVencimento: new Date(Date.now() - 60_000).toISOString() }),
    });
    assert.equal(boleto.resposta.status, 201);
    const entradaEmpresaBloqueada = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'EMP2A34' }),
    });
    assert.equal(entradaEmpresaBloqueada.resposta.status, 409);
    const quitacao = await requisitar(baseUrl, '/api/clientes/22222222000122/quitar-boleto', { method: 'POST' });
    assert.equal(quitacao.resposta.status, 200);
    assert.equal(quitacao.dados.saldoDevedor, 0);
    const entradaEmpresaLiberada = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'EMP2A34' }),
    });
    assert.equal(entradaEmpresaLiberada.resposta.status, 201);
    await requisitar(baseUrl, '/api/saidas', { method: 'POST', body: JSON.stringify({ placa: 'EMP2A34' }) });
    console.log('✅ API acumula débito empresarial, emite boleto, bloqueia após vencimento e libera após quitação.');

    await requisitar(baseUrl, '/api/entradas', { method: 'POST', body: JSON.stringify({ placa: 'AVU2A34' }) });
    const recusaAvulso = await requisitar(baseUrl, '/api/saidas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'AVU2A34', pagamentoRecusado: true }),
    });
    assert.equal(recusaAvulso.resposta.status, 200);
    assert.equal(recusaAvulso.dados.cobranca.politica, 'pagamento-na-saida');
    assert.equal(recusaAvulso.dados.cobranca.placaBloqueada, true);

    const avulsoBloqueado = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'AVU2A34' }),
    });
    assert.equal(avulsoBloqueado.resposta.status, 409);
    const desbloqueio = await requisitar(baseUrl, '/api/placas/AVU2A34/desbloquear', { method: 'POST' });
    assert.equal(desbloqueio.resposta.status, 200);
    const avulsoLiberado = await requisitar(baseUrl, '/api/entradas', {
      method: 'POST',
      body: JSON.stringify({ placa: 'AVU2A34' }),
    });
    assert.equal(avulsoLiberado.resposta.status, 201);
    console.log('✅ API bloqueia avulso após recusa e permite nova entrada somente após regularização.');

    const eventos = await requisitar(baseUrl, '/api/eventos?limite=200');
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'CLIENTE_BLOQUEADO'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'CLIENTE_DESBLOQUEADO'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'BOLETO_EMITIDO'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'BOLETO_QUITADO'));
    assert.ok(eventos.dados.eventos.some((evento) => evento.tipo === 'PLACA_DESBLOQUEADA'));
    instancia.estacionamento.salvarTudo(caminhos);
    const restaurado = criarServidor({
      diretorioDados: diretorio,
      caminhoConfiguracao: path.join(diretorio, 'config', 'estacionamento.json'),
    });
    assert.ok(restaurado.estacionamento.consultarEventos({ limite: 200 }).total >= eventos.dados.total);
    console.log('✅ Histórico financeiro e de bloqueios permanece consultável após persistência.');
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

executar().catch((erro) => {
  console.error('❌ Teste da API financeira falhou:', erro);
  process.exitCode = 1;
});
