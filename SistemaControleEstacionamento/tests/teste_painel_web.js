const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { criarServidor, criarCaminhos } = require('../server');

async function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-painel-web-'));
  const instancia = criarServidor({
    configuracao: null,
    diretorioDados: diretorio,
    caminhoConfiguracao: path.join(diretorio, 'config', 'estacionamento.json'),
  });
  const servidor = instancia.httpApp.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    servidor.once('listening', resolve);
    servidor.once('error', reject);
  });
  const baseUrl = `http://127.0.0.1:${servidor.address().port}`;

  try {
    const pagina = await fetch(`${baseUrl}/`);
    assert.equal(pagina.status, 200);
    assert.match(pagina.headers.get('content-type'), /text\/html/);
    const html = await pagina.text();
    assert.match(html, /id="setupView"/);
    assert.match(html, /id="dashboardView"/);
    assert.match(html, /id="configurationForm"/);
    assert.match(html, /id="entryForm"/);
    assert.match(html, /id="exitForm"/);
    assert.match(html, /id="generationForm"/);
    assert.match(html, /id="eventTerminal"/);
    assert.match(html, /id="startSimulationButton"/);
    assert.match(html, /id="parkingCanvas"/);
    assert.match(html, /id="mapCategoryFilter"/);
    assert.match(html, /id="mapPrevPage"/);
    assert.match(html, /id="mapNextPage"/);
    assert.match(html, /\/styles\.css/);
    assert.match(html, /\/app\.js/);
    console.log('✅ Página principal entrega assistente de configuração e controles operacionais do painel.');

    const cssResposta = await fetch(`${baseUrl}/styles.css`);
    assert.equal(cssResposta.status, 200);
    assert.match(cssResposta.headers.get('content-type'), /text\/css/);
    const css = await cssResposta.text();
    assert.match(css, /pixel/i);
    assert.match(css, /@media/);
    assert.match(css, /\.vacancy-occupied/);
    assert.match(css, /\.event-terminal/);
    assert.match(css, /\.canvas-shell/);
    assert.match(css, /image-rendering: pixelated/);
    assert.match(css, /\.map-pagination/);
    console.log('✅ Folha de estilos é servida com identidade pixel art e layout responsivo.');

    const jsResposta = await fetch(`${baseUrl}/app.js`);
    assert.equal(jsResposta.status, 200);
    assert.match(jsResposta.headers.get('content-type'), /javascript/);
    const javascript = await jsResposta.text();
    for (const rota of [
      '/api/configuracao',
      '/api/estado',
      '/api/vagas',
      '/api/veiculos/estacionados',
      '/api/clientes',
      '/api/eventos',
      '/api/entradas',
      '/api/saidas',
      '/api/clientes/gerar',
      '/api/simulacao/iniciar',
      '/api/simulacao/pausar',
      '/api/simulacao/retomar',
      '/api/simulacao/velocidade',
      '/api/simulacao/encerrar',
    ]) {
      assert.ok(javascript.includes(rota), `frontend deve consumir ${rota}`);
    }
    assert.match(javascript, /textContent/);
    assert.match(javascript, /setInterval/);
    assert.match(javascript, /pagamentoRecusado/);
    assert.match(javascript, /origem: 'api'/);
    assert.match(javascript, /getContext\('2d'\)/);
    assert.match(javascript, /imageSmoothingEnabled = false/);
    assert.match(javascript, /mapHitBoxes/);
    assert.match(javascript, /selecionarVagaNoMapa/);
    assert.match(javascript, /micro-onibus/);
    assert.match(javascript, /mapPageSize: 80/);
    assert.doesNotMatch(javascript, /react-dom|createRoot\(|new Phaser\./i);
    console.log('✅ Frontend usa API HTTP e Canvas 2D com sprites, seleção por hitbox e paginação real de vagas.');

    const health = await fetch(`${baseUrl}/api/health`);
    const dadosHealth = await health.json();
    assert.equal(dadosHealth.status, 'ok');
    assert.equal(dadosHealth.configuracaoNecessaria, true);
    console.log('✅ Primeira execução pode abrir o assistente de configuração antes de existir um estacionamento.');
  } finally {
    await new Promise((resolve) => servidor.close(resolve));
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

executar().catch((erro) => {
  console.error('❌ Teste do painel web falhou:', erro);
  process.exitCode = 1;
});
