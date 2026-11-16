const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
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
    assert.match(html, /data-field="id"/);
    assert.match(html, /class="color-palette"/);
    assert.doesNotMatch(html, /type="color"/);
    assert.match(html, /id="entryForm"/);
    assert.match(html, /id="exitForm"/);
    assert.match(html, /id="generationForm"/);
    assert.match(html, /id="eventTerminal"/);
    assert.match(html, /id="securityGuardStatus"/);
    assert.match(html, /id="simulationFleetSize"/);
    assert.match(html, /class="control-room"/);
    assert.match(html, /id="startSimulationButton"/);
    assert.match(html, /id="parkingCanvas"/);
    assert.match(html, /id="mapCategoryFilter"/);
    assert.match(html, /<title>Poltosi Pixel Park — Painel operacional<\/title>/);
    assert.match(html, /<strong>POLTOSI PIXEL PARK<\/strong>/);
    assert.match(html, /value="Poltosi Pixel Park"/);
    assert.match(html, /CIRCUITO VIÁRIO · TODAS AS VAGAS/);
    assert.match(html, /Avenida principal, corredor de entrada, pistas de acesso/i);
    assert.doesNotMatch(html, /mapPrevPage|mapNextPage|vacancyGrid|showAllVacanciesButton/);
    assert.match(html, /\/assets\/pixel-assets\.js/);
    assert.match(html, /\/styles\.css/);
    assert.match(html, /\/app\.js/);
    assert.ok(html.indexOf('/assets/pixel-assets.js') < html.indexOf('/app.js'), 'assets devem ser carregados antes do renderizador');
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
    assert.match(css, /\.control-room/);
    assert.match(css, /\.security-guard/);
    assert.match(css, /grid-template-areas: "actions yard"/);
    assert.match(css, /\.color-palette/);
    assert.match(css, /\.color-swatch/);
    console.log('✅ Folha de estilos é servida com identidade pixel art e layout responsivo.');

    const jsResposta = await fetch(`${baseUrl}/app.js`);
    assert.equal(jsResposta.status, 200);
    assert.match(jsResposta.headers.get('content-type'), /javascript/);
    const javascript = await jsResposta.text();
    assert.doesNotThrow(() => new vm.Script(javascript, { filename: 'public/app.js' }));
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
    for (const categoria of ['Estudante', 'Funcionário', 'Professor', 'Geral']) {
      assert.ok(javascript.includes(categoria), `frontend deve oferecer a categoria ${categoria}`);
    }
    assert.match(javascript, /PALETA_CORES/);
    assert.match(javascript, /sincronizarOpcoesCategorias/);
    assert.match(javascript, /categoriasDoPerfil/);
    assert.match(javascript, /idsCategoriasConfiguradas\.has\('geral'\)/);
    assert.match(javascript, /state\.mapVisibleSlots = filtradas/);
    assert.match(javascript, /function processarNovosEventos/);
    assert.match(javascript, /function desenharAnimacoesTransito/);
    assert.match(javascript, /function desenharRedeViaria/);
    assert.match(javascript, /function pintarPistaHorizontal/);
    assert.match(javascript, /function pintarPistaVertical/);
    assert.match(javascript, /function criarCaminhoEntrada/);
    assert.match(javascript, /function criarCaminhoSaida/);
    assert.match(javascript, /function amostrarCaminho/);
    assert.match(javascript, /CORREDOR_ENTRADA_X/);
    assert.match(javascript, /CORREDOR_SAIDA_X/);
    assert.match(javascript, /faixaRodagemY/);
    assert.doesNotMatch(javascript, /lerp\(-28, alvo\.x/);
    assert.match(javascript, /requestAnimationFrame/);
    assert.match(javascript, /intervaloChegadaMs: 1600/);
    assert.match(javascript, /Number\(\$\('#simulationFleetSize'\)\.value\)/);
    assert.match(javascript, /ParkingPixelAssets/);
    assert.doesNotMatch(javascript, /react-dom|createRoot\(|new Phaser\./i);
    const idsHtml = new Set(Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1]));
    const idsConsultados = Array.from(javascript.matchAll(/\$\('#([^']+)'\)/g), (match) => match[1]);
    idsConsultados.forEach((id) => assert.ok(idsHtml.has(id), `o painel consulta #${id}, que deve existir no HTML`));
    const assetsResposta = await fetch(`${baseUrl}/assets/pixel-assets.js`);
    assert.equal(assetsResposta.status, 200);
    assert.match(assetsResposta.headers.get('content-type'), /javascript/);
    const assets = await assetsResposta.text();
    assert.doesNotThrow(() => new vm.Script(assets, { filename: 'public/assets/pixel-assets.js' }));
    for (const tipo of ['motocicleta', 'compacto', 'hatch', 'sedan', 'suv', 'picape', 'van', 'micro-onibus']) {
      assert.ok(assets.includes(tipo), `asset pixel art deve incluir o tipo ${tipo}`);
    }
    assert.ok(assets.includes('asphaltDots'));
    assert.ok(assets.includes('vehicleWindows'));
    console.log('✅ Assets pixel art são servidos separadamente e contêm sprites e tiles originais.');

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
