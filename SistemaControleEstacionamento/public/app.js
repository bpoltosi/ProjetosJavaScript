(() => {
  'use strict';

  const $ = (seletor) => document.querySelector(seletor);
  const TIPOS_VEICULO = [
    'motocicleta', 'compacto', 'hatch', 'sedan',
    'suv', 'picape', 'van', 'micro-onibus',
  ];
  const CATEGORIAS_ESTACIONAMENTO = [
    { id: 'estudante', nome: 'Estudante', corPadrao: '#4D91D1' },
    { id: 'funcionario', nome: 'Funcionário', corPadrao: '#D6B34A' },
    { id: 'professor', nome: 'Professor', corPadrao: '#8B78C5' },
    { id: 'geral', nome: 'Geral', corPadrao: '#65A878' },
  ];
  const PALETA_CORES = [
    { nome: 'Verde', valor: '#65A878' },
    { nome: 'Azul', valor: '#4D91D1' },
    { nome: 'Roxo', valor: '#8B78C5' },
    { nome: 'Amarelo', valor: '#D6B34A' },
    { nome: 'Laranja', valor: '#E58A45' },
    { nome: 'Vermelho', valor: '#D66F78' },
    { nome: 'Turquesa', valor: '#46A6A0' },
    { nome: 'Cinza', valor: '#A7ADB4' },
  ];

  const state = {
    configuracao: null,
    vagas: [],
    veiculos: [],
    clientes: [],
    eventos: [],
    simulacao: null,
    mapVisibleSlots: [],
    animacoesTransito: [],
    eventosInicializados: false,
    idsEventosConhecidos: new Set(),
    animacaoFrame: null,
    mapHitBoxes: [],
    selectedSlotId: null,
    ultimaFalhaConexao: false,
    polling: null,
    ultimaAtualizacao: null,
  };

  async function api(metodo, rota, corpo) {
    const resposta = await fetch(rota, {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    });

    const tipo = resposta.headers.get('content-type') || '';
    const dados = tipo.includes('application/json') ? await resposta.json() : await resposta.text();

    if (!resposta.ok) {
      const mensagem = dados && dados.erro && dados.erro.mensagem
        ? dados.erro.mensagem
        : (dados && dados.mensagem) || `Falha HTTP ${resposta.status}`;
      const erro = new Error(mensagem);
      erro.status = resposta.status;
      throw erro;
    }
    return dados;
  }

  function toast(mensagem, tipo = 'success') {
    const regiao = $('#toastRegion');
    if (!regiao) return;
    const elemento = document.createElement('div');
    elemento.className = `toast ${tipo === 'error' ? 'error' : tipo === 'warning' ? 'warning' : ''}`;
    elemento.textContent = mensagem;
    regiao.append(elemento);
    window.setTimeout(() => elemento.remove(), 4200);
  }

  function statusConexao(online, mensagem) {
    const elemento = $('#connectionStatus');
    if (!elemento) return;
    elemento.classList.toggle('status-online', online);
    elemento.classList.toggle('status-offline', !online);
    elemento.classList.toggle('status-waiting', false);
    elemento.innerHTML = '<span class="status-light"></span>';
    elemento.append(document.createTextNode(online ? ' API ONLINE' : ' API OFFLINE'));
    if (mensagem) elemento.title = mensagem;
  }

  function mostrarTelaConfiguracao() {
    $('#setupView').classList.remove('hidden');
    $('#dashboardView').classList.add('hidden');
  }

  function mostrarPainel() {
    $('#setupView').classList.add('hidden');
    $('#dashboardView').classList.remove('hidden');
  }

  function atualizarRelogio() {
    const agora = new Date();
    $('#clockLabel').textContent = agora.toLocaleTimeString('pt-BR', { hour12: false });
    $('#currentDateLabel').textContent = agora.toLocaleDateString('pt-BR');
  }

  function definirCorLinhaCategoria(linha, cor) {
    const valor = String(cor).toUpperCase();
    linha.querySelector('[data-field="cor"]').value = valor;
    linha.querySelectorAll('.color-swatch').forEach((botao) => {
      const selecionada = botao.dataset.color === valor;
      botao.classList.toggle('is-selected', selecionada);
      botao.setAttribute('aria-pressed', selecionada ? 'true' : 'false');
    });
  }

  function sincronizarOpcoesCategorias() {
    const linhas = Array.from($('#categoryRows').children);
    const categoriasSelecionadas = new Set(
      linhas.map((linha) => linha.querySelector('[data-field="id"]').value).filter(Boolean)
    );

    linhas.forEach((linha) => {
      const seletor = linha.querySelector('[data-field="id"]');
      Array.from(seletor.options).forEach((opcao) => {
        opcao.disabled = Boolean(
          opcao.value &&
          opcao.value !== seletor.value &&
          categoriasSelecionadas.has(opcao.value)
        );
      });
    });

    $('#addCategoryButton').disabled = linhas.length >= CATEGORIAS_ESTACIONAMENTO.length;
  }

  function adicionarLinhaCategoria(dados = {}) {
    const linhasAtuais = Array.from($('#categoryRows').children);
    if (linhasAtuais.length >= CATEGORIAS_ESTACIONAMENTO.length) {
      toast('Todas as categorias predefinidas já foram adicionadas.', 'warning');
      return;
    }

    const categoriasEmUso = new Set(
      linhasAtuais.map((linha) => linha.querySelector('[data-field="id"]').value)
    );
    const categoriaInicial = CATEGORIAS_ESTACIONAMENTO.find((categoria) =>
      categoria.id === dados.id || !categoriasEmUso.has(categoria.id)
    );
    if (!categoriaInicial) return;

    const modelo = $('#categoryRowTemplate');
    const linha = modelo.content.firstElementChild.cloneNode(true);
    const seletor = linha.querySelector('[data-field="id"]');

    CATEGORIAS_ESTACIONAMENTO.forEach((categoria) => {
      const opcao = document.createElement('option');
      opcao.value = categoria.id;
      opcao.textContent = categoria.nome;
      seletor.append(opcao);
    });
    seletor.value = categoriaInicial.id;

    linha.querySelector('[data-field="quantidade"]').value = dados.quantidade ?? 1;
    linha.querySelector('[data-field="acessibilidade"]').checked = dados.requerAcessibilidade === true;

    const paleta = linha.querySelector('[data-field="paleta"]');
    PALETA_CORES.forEach((cor) => {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'color-swatch';
      botao.dataset.color = cor.valor;
      botao.style.setProperty('--swatch-color', cor.valor);
      botao.title = `${cor.nome} ${cor.valor}`;
      botao.setAttribute('aria-label', `${cor.nome}, ${cor.valor}`);
      botao.setAttribute('aria-pressed', 'false');
      botao.addEventListener('click', () => definirCorLinhaCategoria(linha, cor.valor));
      paleta.append(botao);
    });

    const categoriaSelecionada = CATEGORIAS_ESTACIONAMENTO.find((categoria) => categoria.id === seletor.value);
    definirCorLinhaCategoria(linha, dados.cor ?? categoriaSelecionada.corPadrao);

    seletor.addEventListener('change', () => {
      const categoria = CATEGORIAS_ESTACIONAMENTO.find((item) => item.id === seletor.value);
      if (categoria) definirCorLinhaCategoria(linha, categoria.corPadrao);
      sincronizarOpcoesCategorias();
    });
    linha.querySelector('[data-field="quantidade"]').addEventListener('input', atualizarDistribuicao);
    linha.querySelector('[data-field="quantidade"]').addEventListener('change', atualizarDistribuicao);

    linha.querySelector('.remove-category').addEventListener('click', () => {
      if ($('#categoryRows').children.length <= 1) {
        toast('O estacionamento precisa ter ao menos uma categoria de vaga.', 'warning');
        return;
      }
      linha.remove();
      sincronizarOpcoesCategorias();
      atualizarDistribuicao();
    });

    $('#categoryRows').append(linha);
    sincronizarOpcoesCategorias();
    atualizarDistribuicao();
  }

  function atualizarDistribuicao() {
    const capacidade = Number($('#parkingCapacity').value) || 0;
    const quantidade = Array.from($('#categoryRows').querySelectorAll('[data-field="quantidade"]'))
      .reduce((soma, entrada) => soma + (Number(entrada.value) || 0), 0);
    const total = $('#distributionTotal');
    total.textContent = `${quantidade} / ${capacidade}`;
    total.style.color = quantidade === capacidade ? 'var(--green)' : 'var(--yellow)';
    $('#distributionBar').style.width = capacidade > 0
      ? `${Math.min(100, quantidade / capacidade * 100)}%`
      : '0%';
  }

  function coletarConfiguracao() {
    const nome = $('#parkingName').value.trim();
    const capacidadeTotal = Number($('#parkingCapacity').value);
    if (!nome) throw new Error('Informe o nome do estabelecimento.');
    if (!Number.isSafeInteger(capacidadeTotal) || capacidadeTotal < 1 || capacidadeTotal > 10000) {
      throw new Error('A capacidade deve ser um inteiro entre 1 e 10000.');
    }

    const categorias = Array.from($('#categoryRows').children).map((linha) => {
      const id = linha.querySelector('[data-field="id"]').value;
      const categoriaBase = CATEGORIAS_ESTACIONAMENTO.find((categoria) => categoria.id === id);
      const quantidade = Number(linha.querySelector('[data-field="quantidade"]').value);
      const cor = linha.querySelector('[data-field="cor"]').value.toUpperCase();
      const requerAcessibilidade = linha.querySelector('[data-field="acessibilidade"]').checked;

      if (!categoriaBase) throw new Error('Selecione uma das categorias predefinidas.');
      if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
        throw new Error(`A quantidade de vagas da categoria "${categoriaBase.nome}" deve ser um inteiro positivo.`);
      }

      return {
        id: categoriaBase.id,
        nome: categoriaBase.nome,
        quantidade,
        cor,
        criteriosElegibilidade: {
          categoriasCliente: id === 'geral' ? ['*'] : [id],
          requerAcessibilidade,
        },
        tiposVeiculoPermitidos: TIPOS_VEICULO,
        dimensoesMaximas: null,
      };
    });

    if (categorias.length === 0) throw new Error('Adicione ao menos uma categoria de vagas.');
    const ids = categorias.map((categoria) => categoria.id);
    if (new Set(ids).size !== ids.length) throw new Error('Escolha cada categoria predefinida apenas uma vez.');

    const soma = categorias.reduce((total, categoria) => total + categoria.quantidade, 0);
    if (soma !== capacidadeTotal) {
      throw new Error(`A distribuição soma ${soma} vaga(s), mas a capacidade informada é ${capacidadeTotal}.`);
    }

    const idsCategoriasConfiguradas = new Set(ids);
    const categoriasDoPerfil = (id) => {
      const permitidas = [];
      if (idsCategoriasConfiguradas.has(id)) permitidas.push(id);
      if (id !== 'geral' && idsCategoriasConfiguradas.has('geral')) permitidas.push('geral');
      return permitidas.length > 0 ? permitidas : ['*'];
    };

    return {
      versao: 1,
      nome,
      capacidadeTotal,
      categorias,
      perfisCliente: [
        { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: categoriasDoPerfil('estudante') },
        { id: 'funcionario', nome: 'Funcionário', classeDominio: 'personalizado', limitePlacas: 2, categoriasVagaPermitidas: categoriasDoPerfil('funcionario') },
        { id: 'professor', nome: 'Professor', classeDominio: 'professor', limitePlacas: 2, categoriasVagaPermitidas: categoriasDoPerfil('professor') },
        { id: 'empresa', nome: 'Empresa', classeDominio: 'empresa', limitePlacas: null, categoriasVagaPermitidas: categoriasDoPerfil('geral') },
      ],
    };
  }

  async function enviarConfiguracao(evento) {
    evento.preventDefault();
    const erro = $('#configurationError');
    erro.textContent = '';
    try {
      const configuracao = coletarConfiguracao();
      await api('PUT', '/api/configuracao', configuracao);
      state.configuracao = configuracao;
      toast('Configuração salva. O painel operacional está pronto.');
      await carregarTudo();
      iniciarPolling();
    } catch (falha) {
      erro.textContent = falha.message;
      toast(falha.message, 'error');
    }
  }

  function definirTexto(id, valor) {
    const elemento = $(`#${id}`);
    if (elemento) elemento.textContent = valor;
  }

  function atualizarIndicadores(dados) {
    const resumo = dados.vagas || { total: 0, ocupadas: 0, livres: 0, bloqueadas: 0 };
    const ocupadas = resumo.ocupadas || 0;
    const total = resumo.total || 0;
    const percentual = total ? Math.round(ocupadas / total * 100) : 0;

    definirTexto('parkingTitle', dados.nomeEstacionamento || state.configuracao?.nome || 'ESTACIONAMENTO');
    definirTexto('occupiedCount', String(ocupadas));
    definirTexto('occupancyPercent', `${percentual}%`);
    definirTexto('capacityLabel', `${ocupadas} / ${total} vagas ocupadas`);
    $('#occupancyBar').style.width = `${percentual}%`;
    definirTexto('freeCount', String(resumo.livres || 0));
    definirTexto('blockedCount', String(resumo.bloqueadas || 0));
    definirTexto('vehicleCount', String(dados.veiculosEstacionados || 0));
    definirTexto('clientCount', `${dados.clientesCadastrados || 0} clientes cadastrados`);
    definirTexto('eventCount', String(dados.eventosRegistrados || 0));
  }


  const PIXEL_ASSETS = window.ParkingPixelAssets || {};
  const SPRITES = PIXEL_ASSETS.sprites || {};
  const MAP_PALETTE = PIXEL_ASSETS.palette || {};


  function corParaPixel(cor, fallback = '#A7ADB4') {
    return typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor) ? cor : fallback;
  }

  function desenharSprite(ctx, veiculo, x, y, larguraMaxima, alturaMaxima, rotacao = 0) {
    const tipo = veiculo?.tipoVeiculo || 'sedan';
    const sprite = SPRITES[tipo] || SPRITES.sedan;
    const colunas = Math.max(...sprite.map((linha) => linha.length));
    const linhas = sprite.length;
    const pixel = Math.max(1, Math.floor(Math.min(3, larguraMaxima / colunas, alturaMaxima / linhas)));
    const largura = colunas * pixel;
    const altura = linhas * pixel;
    const inicioX = Math.floor(-largura / 2);
    const inicioY = Math.floor(-altura / 2);
    const body = corParaPixel(veiculo?.corVeiculo || veiculo?.cor, MAP_PALETTE.vehicleFallback || '#A7ADB4');

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotacao);
    ctx.fillStyle = 'rgba(0, 0, 0, .38)';
    ctx.fillRect(inicioX + 3, inicioY + 4, largura, altura);

    for (let linha = 0; linha < sprite.length; linha += 1) {
      for (let coluna = 0; coluna < sprite[linha].length; coluna += 1) {
        const caractere = sprite[linha][coluna];
        if (caractere === '0') continue;
        if (caractere === '1') ctx.fillStyle = body;
        else if (caractere === '2') ctx.fillStyle = MAP_PALETTE.vehicleWindows || '#9DD3DE';
        else if (caractere === '3') ctx.fillStyle = MAP_PALETTE.vehicleTires || '#111A18';
        else if (caractere === '4') ctx.fillStyle = MAP_PALETTE.vehicleLights || '#F5D77B';
        else ctx.fillStyle = body;
        ctx.fillRect(inicioX + coluna * pixel, inicioY + linha * pixel, pixel, pixel);
      }
    }

    ctx.globalAlpha = .2;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(inicioX + pixel * 2, inicioY + pixel * 3, pixel, Math.max(pixel, altura * .18));
    ctx.restore();
  }

  function agruparVagasPorCategoria(vagas) {
    const grupos = new Map();
    vagas.forEach((vaga) => {
      const id = vaga.categoriaId || 'geral';
      if (!grupos.has(id)) grupos.set(id, []);
      grupos.get(id).push(vaga);
    });
    return Array.from(grupos.entries()).map(([id, itens]) => ({
      id,
      nome: itens[0]?.categoriaNome || id,
      cor: corParaPixel(itens[0]?.cor, '#65A878'),
      vagas: itens,
    }));
  }

  function vagasDoMapa() {
    const categoria = $('#mapCategoryFilter')?.value || '';
    return state.vagas
      .filter((vaga) => !categoria || vaga.categoriaId === categoria)
      .slice()
      .sort((a, b) => String(a.categoriaId).localeCompare(String(b.categoriaId)) ||
        String(a.id).localeCompare(String(b.id), undefined, { numeric: true }));
  }

  const PISTA_Y = 64;

  function desenharFundoMapa(ctx, largura, altura) {
    ctx.fillStyle = MAP_PALETTE.asphalt || '#26372F';
    ctx.fillRect(0, 0, largura, altura);
    const textura = MAP_PALETTE.asphaltDots || [[8, 8], [18, 13], [12, 21], [25, 4]];
    for (let y = 92; y < altura; y += 30) {
      for (let x = 8; x < largura; x += 34) {
        textura.forEach(([dx, dy]) => {
          ctx.fillStyle = MAP_PALETTE.asphaltTile || '#2B3D34';
          ctx.fillRect(x + dx, y + dy, 2, 2);
        });
      }
    }

    ctx.fillStyle = MAP_PALETTE.header || '#17251F';
    ctx.fillRect(0, 0, largura, 30);
    ctx.fillStyle = MAP_PALETTE.headerText || '#AFCB9A';
    ctx.font = 'bold 10px "Lucida Console", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ENTRADA  ◀', 14, 19);
    ctx.textAlign = 'center';
    ctx.fillStyle = MAP_PALETTE.roadText || '#D8E4CF';
    ctx.fillText('PISTA DE CIRCULAÇÃO · SENTIDO ÚNICO', largura / 2, 19);
    ctx.textAlign = 'right';
    ctx.fillText('SAÍDA  ▶', largura - 14, 19);

    ctx.fillStyle = '#1A2923';
    ctx.fillRect(0, 38, largura, 48);
    ctx.strokeStyle = MAP_PALETTE.roadStripe || '#E4D28A';
    ctx.lineWidth = 2;
    ctx.setLineDash([11, 9]);
    ctx.beginPath();
    ctx.moveTo(8, PISTA_Y);
    ctx.lineTo(largura - 8, PISTA_Y);
    ctx.stroke();
    ctx.setLineDash([]);

    // Guarita, operador e cancela em pixel art.
    ctx.fillStyle = '#526B59';
    ctx.fillRect(104, 29, 28, 25);
    ctx.fillStyle = '#A8C6A6';
    ctx.fillRect(109, 33, 18, 8);
    ctx.fillStyle = '#24352B';
    ctx.fillRect(109, 44, 18, 7);
    ctx.fillStyle = '#E6CE7E';
    ctx.fillRect(137, 48, 30, 3);
    ctx.fillStyle = '#B75E50';
    ctx.fillRect(137, 44, 4, 11);
    ctx.fillRect(163, 44, 4, 11);
    ctx.fillStyle = '#E9D18C';
    ctx.fillRect(142, 45, 4, 3);
    ctx.fillRect(150, 45, 4, 3);
    ctx.fillRect(158, 45, 4, 3);
  }

  function desenharVaga(ctx, vaga, caixa, selecionada, veiculo) {
    const status = vaga.status || 'livre';
    const centroX = caixa.x + caixa.w / 2;
    const centroY = caixa.y + caixa.h / 2 + 4;

    // A vaga é marcada apenas pela pintura no asfalto. Não há cartões coloridos
    // para livre/ocupada: a presença do veículo informa a ocupação.
    ctx.save();
    ctx.strokeStyle = selecionada ? (MAP_PALETTE.selection || '#F4D273') : 'rgba(218, 232, 218, .62)';
    ctx.lineWidth = selecionada ? 3 : 1.4;
    ctx.setLineDash(selecionada ? [] : [4, 4]);
    ctx.strokeRect(caixa.x + 2, caixa.y + 2, caixa.w - 4, caixa.h - 4);
    ctx.setLineDash([]);

    ctx.fillStyle = selecionada ? '#FFE18B' : '#B8C8BA';
    ctx.font = 'bold 8px "Lucida Console", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(vaga.id, caixa.x + 6, caixa.y + 12, caixa.w - 12);

    if (status === 'ocupada') {
      desenharSprite(ctx, veiculo || { tipoVeiculo: 'sedan', corVeiculo: '#A7ADB4' },
        centroX, centroY + 2, caixa.w - 16, caixa.h - 20);
      ctx.fillStyle = '#F0F5E8';
      ctx.font = 'bold 7px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(vaga.placa || 'OCUPADA', centroX, caixa.y + caixa.h - 5, caixa.w - 6);
    } else if (status === 'bloqueada') {
      ctx.strokeStyle = '#E98378';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(caixa.x + 10, caixa.y + caixa.h - 13);
      ctx.lineTo(caixa.x + caixa.w - 10, caixa.y + 20);
      ctx.stroke();
      ctx.strokeStyle = '#F2C96B';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(caixa.x + 10, caixa.y + caixa.h - 13);
      ctx.lineTo(caixa.x + caixa.w - 10, caixa.y + 20);
      ctx.stroke();
      ctx.fillStyle = '#FFB4A7';
      ctx.font = 'bold 7px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BLOQUEADA', centroX, caixa.y + caixa.h - 5, caixa.w - 6);
    }
    ctx.restore();
  }

  function desenharMapa() {
    const canvas = $('#parkingCanvas');
    const shell = $('#canvasShell');
    if (!canvas || !shell) return;

    // Mantém uma planta larga também em telas estreitas; o contêiner permite rolagem horizontal.
    const largura = Math.max(900, Math.floor(shell.clientWidth - 4));
    const filtradas = vagasDoMapa();
    state.mapVisibleSlots = filtradas;
    const grupos = agruparVagasPorCategoria(filtradas);
    const margem = 22;
    const espacamentoX = 4;
    const espacamentoY = 4;
    const colunas = Math.max(3, Math.min(48, Math.floor((largura - margem * 2 + espacamentoX) / 38)));
    const slotW = Math.max(32, Math.floor((largura - margem * 2 - espacamentoX * (colunas - 1)) / colunas));
    const slotH = 52;
    let cursorY = 105;
    const caixas = [];

    grupos.forEach((grupo) => {
      cursorY += 8;
      const topoGrupo = cursorY;
      cursorY += 21;
      grupo.vagas.forEach((vaga, indice) => {
        const linha = Math.floor(indice / colunas);
        const coluna = indice % colunas;
        const faixaCirculacao = Math.floor(linha / 4) * 12;
        const y = cursorY + linha * (slotH + espacamentoY) + faixaCirculacao;
        const x = margem + coluna * (slotW + espacamentoX);
        caixas.push({ vaga, x, y, w: slotW, h: slotH, topoGrupo, grupoId: grupo.id });
      });
      const linhas = Math.ceil(grupo.vagas.length / colunas);
      const faixasCirculacao = Math.floor(Math.max(0, linhas - 1) / 4);
      cursorY += linhas * (slotH + espacamentoY) + faixasCirculacao * 12 + 24;
    });

    const altura = Math.max(320, cursorY + 16);
    if (canvas.width !== largura) canvas.width = largura;
    if (canvas.height !== altura) canvas.height = altura;
    canvas.style.height = altura + 'px';
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    desenharFundoMapa(ctx, largura, altura);

    grupos.forEach((grupo) => {
      const caixasGrupo = caixas.filter((caixa) => caixa.grupoId === grupo.id);
      if (!caixasGrupo.length) return;
      const topo = Math.min(...caixasGrupo.map((caixa) => caixa.y)) - 16;
      const fundo = Math.max(...caixasGrupo.map((caixa) => caixa.y + caixa.h)) + 8;
      ctx.fillStyle = 'rgba(16, 29, 23, .22)';
      ctx.fillRect(8, topo, largura - 16, fundo - topo);
      ctx.strokeStyle = grupo.cor;
      ctx.globalAlpha = .48;
      ctx.lineWidth = 1;
      ctx.strokeRect(8, topo, largura - 16, fundo - topo);
      ctx.globalAlpha = 1;
      ctx.fillStyle = grupo.cor;
      ctx.fillRect(8, topo, 4, fundo - topo);
      ctx.font = 'bold 10px "Lucida Console", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(grupo.nome.toUpperCase() + ' · ' + grupo.vagas.length + ' VAGA(S)', 17, topo - 4);

      const linhasGrupo = Array.from(new Set(caixasGrupo.map((caixa) => caixa.y))).sort((a, b) => a - b);
      for (let indiceLinha = 1; indiceLinha < linhasGrupo.length; indiceLinha += 1) {
        if (indiceLinha % 4 !== 0) continue;
        const faixaY = Math.floor((linhasGrupo[indiceLinha - 1] + slotH + linhasGrupo[indiceLinha]) / 2);
        ctx.fillStyle = '#182821';
        ctx.fillRect(12, faixaY - 5, largura - 24, 14);
        ctx.strokeStyle = '#B2C69A';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 8]);
        ctx.beginPath();
        ctx.moveTo(20, faixaY + 2);
        ctx.lineTo(largura - 20, faixaY + 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    });

    state.mapHitBoxes = caixas;
    const veiculosPorPlaca = new Map(state.veiculos.map((veiculo) => [veiculo.placa, veiculo]));
    caixas.forEach((caixa) => {
      const selecionada = state.selectedSlotId === caixa.vaga.id;
      const veiculo = caixa.vaga.placa ? veiculosPorPlaca.get(caixa.vaga.placa) : null;
      desenharVaga(ctx, caixa.vaga, caixa, selecionada, veiculo);
    });

    desenharAnimacoesTransito(ctx, largura);
    definirTexto('mapCaption', $('#mapCategoryFilter')?.value
      ? 'Setor filtrado: ' + ($('#mapCategoryFilter').selectedOptions[0]?.textContent || 'selecionado') + ' · ' + filtradas.length + ' vaga(s) nesta visão.'
      : 'Visão única de ' + filtradas.length + ' vaga(s). Veículos entram, estacionam, saem e têm tentativas negadas animadas no próprio pátio.');
  }

  function lerp(inicio, fim, progresso) {
    return inicio + (fim - inicio) * progresso;
  }

  function desenharAnimacoesTransito(ctx, largura) {
    const agora = performance.now();
    const ativas = [];
    state.animacoesTransito.forEach((animacao) => {
      const progressoBruto = (agora - animacao.inicio) / animacao.duracao;
      if (progressoBruto >= 1) return;
      ativas.push(animacao);
      const progresso = Math.max(0, Math.min(1, progressoBruto));
      const suavizado = progresso * progresso * (3 - 2 * progresso);
      const caixaAlvo = state.mapHitBoxes.find((caixa) => caixa.vaga.id === animacao.vagaId);
      const alvo = caixaAlvo
        ? { x: caixaAlvo.x + caixaAlvo.w / 2, y: caixaAlvo.y + caixaAlvo.h / 2 }
        : { x: Math.round(largura * .62), y: PISTA_Y };
      const caixaOrigem = state.mapHitBoxes.find((caixa) => caixa.vaga.id === animacao.vagaId);
      const origem = caixaOrigem
        ? { x: caixaOrigem.x + caixaOrigem.w / 2, y: caixaOrigem.y + caixaOrigem.h / 2 }
        : { x: Math.round(largura * .62), y: PISTA_Y };
      let x;
      let y;
      let rotacao = Math.PI / 2;

      if (animacao.acao === 'entrada') {
        if (suavizado < .52) {
          x = lerp(-28, alvo.x, suavizado / .52);
          y = PISTA_Y;
        } else {
          x = alvo.x;
          y = lerp(PISTA_Y, alvo.y, (suavizado - .52) / .48);
          rotacao = 0;
        }
      } else if (animacao.acao === 'saida') {
        if (suavizado < .48) {
          x = origem.x;
          y = lerp(origem.y, PISTA_Y, suavizado / .48);
          rotacao = 0;
        } else {
          x = lerp(origem.x, largura + 34, (suavizado - .48) / .52);
          y = PISTA_Y;
        }
      } else {
        const barreiraX = 174;
        if (suavizado < .56) {
          x = lerp(-28, barreiraX, suavizado / .56);
        } else if (suavizado < .79) {
          x = barreiraX;
        } else {
          x = lerp(barreiraX, -38, (suavizado - .79) / .21);
        }
        y = PISTA_Y;
        rotacao = Math.PI / 2;
        if (suavizado >= .56 && suavizado < .79) {
          const piscando = Math.floor(agora / 150) % 2 === 0;
          ctx.fillStyle = piscando ? '#9D4542' : '#713532';
          ctx.fillRect(barreiraX - 9, PISTA_Y - 30, 114, 18);
          ctx.strokeStyle = '#F0C86A';
          ctx.lineWidth = 2;
          ctx.strokeRect(barreiraX - 9, PISTA_Y - 30, 114, 18);
          ctx.fillStyle = '#FFF0D0';
          ctx.font = 'bold 9px "Lucida Console", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('ACESSO BLOQUEADO', barreiraX + 48, PISTA_Y - 18);
        }
      }

      desenharSprite(ctx, animacao.veiculo, x, y, 44, 30, rotacao);
      if (animacao.acao !== 'bloqueada' && animacao.veiculo.placa) {
        ctx.fillStyle = '#F0F4E9';
        ctx.font = 'bold 7px "Lucida Console", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(animacao.veiculo.placa, x, y + (rotacao === 0 ? 27 : 25));
      }
    });
    state.animacoesTransito = ativas;
  }

  function iniciarAnimacaoTransito() {
    if (state.animacaoFrame !== null || !state.animacoesTransito.length) return;
    const animar = () => {
      state.animacaoFrame = null;
      if (!state.animacoesTransito.length) return;
      desenharMapa();
      if (state.animacoesTransito.length) {
        state.animacaoFrame = window.requestAnimationFrame(animar);
      }
    };
    state.animacaoFrame = window.requestAnimationFrame(animar);
  }

  function processarNovosEventos(eventos, veiculosAnteriores) {
    if (!state.eventosInicializados) {
      eventos.forEach((evento) => state.idsEventosConhecidos.add(evento.id));
      state.eventosInicializados = true;
      return;
    }

    const novos = eventos
      .filter((evento) => !state.idsEventosConhecidos.has(evento.id))
      .reverse();

    novos.forEach((evento) => {
      state.idsEventosConhecidos.add(evento.id);
      const tipo = String(evento.tipo || '').toUpperCase();
      let acao = null;
      if (tipo === 'ENTRADA_AUTORIZADA') acao = 'entrada';
      else if (tipo === 'SAIDA_CONCLUIDA' || tipo === 'SAIDA_PAGAMENTO_RECUSADO') acao = 'saida';
      else if (tipo === 'ENTRADA_NEGADA') acao = 'bloqueada';
      if (!acao) return;

      const veiculoAtual = state.veiculos.find((veiculo) => veiculo.placa === evento.placa);
      const veiculoAnterior = veiculosAnteriores.get(evento.placa);
      const cliente = state.clientes.find((item) =>
        item.veiculos?.some((veiculo) => veiculo.placa === evento.placa)
      );
      const veiculoCadastrado = cliente?.veiculos?.find((veiculo) => veiculo.placa === evento.placa);
      const veiculo = {
        placa: evento.placa || 'SEM PLACA',
        tipoVeiculo: evento.tipoVeiculo || veiculoAtual?.tipoVeiculo || veiculoAnterior?.tipoVeiculo || veiculoCadastrado?.tipo || 'hatch',
        corVeiculo: evento.corVeiculo || veiculoAtual?.corVeiculo || veiculoAnterior?.corVeiculo || veiculoCadastrado?.cor || '#D66F78',
      };
      state.animacoesTransito.push({
        acao,
        inicio: performance.now(),
        duracao: acao === 'bloqueada' ? 1850 : 2100,
        veiculo,
        vagaId: evento.vagaId || veiculoAtual?.vagaId || veiculoAnterior?.vagaId || null,
      });
    });

    while (state.idsEventosConhecidos.size > 320) {
      state.idsEventosConhecidos.delete(state.idsEventosConhecidos.values().next().value);
    }
    if (state.animacoesTransito.length > 10) {
      state.animacoesTransito = state.animacoesTransito.slice(-10);
    }
    iniciarAnimacaoTransito();
  }

  function preencherFiltroMapa(configuracao) {
    const select = $('#mapCategoryFilter');
    if (!select) return;
    const atual = select.value;
    select.replaceChildren();
    const todas = document.createElement('option');
    todas.value = '';
    todas.textContent = 'TODAS';
    select.append(todas);
    (configuracao?.categorias || []).forEach((categoria) => {
      const option = document.createElement('option');
      option.value = categoria.id;
      option.textContent = categoria.nome;
      select.append(option);
    });
    if (Array.from(select.options).some((option) => option.value === atual)) select.value = atual;
  }

  function selecionarVagaNoMapa(evento) {
    const canvas = $('#parkingCanvas');
    const limites = canvas.getBoundingClientRect();
    const x = (evento.clientX - limites.left) * (canvas.width / limites.width);
    const y = (evento.clientY - limites.top) * (canvas.height / limites.height);
    const caixa = state.mapHitBoxes.find((item) =>
      x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
    );
    if (!caixa) return;
    const vaga = caixa.vaga;
    state.selectedSlotId = vaga.id;
    if (vaga.status === 'ocupada' && vaga.placa) {
      $('#exitVehicle').value = vaga.placa;
      atualizarCampoRecusa();
      renderizarDetalhes(vaga.placa);
    } else {
      $('#exitVehicle').value = '';
      atualizarCampoRecusa();
      renderizarDetalhesVaga(vaga);
    }
    desenharMapa();
  }


  function renderizarVagas(vagas, resumo) {
    preencherFiltroMapa(state.configuracao);
    desenharMapa();
    definirTexto('vacancySummary',
      (resumo?.total ?? vagas.length) + ' vagas · ' +
      (resumo?.livres ?? 0) + ' livres · ' +
      (resumo?.ocupadas ?? 0) + ' ocupadas · ' +
      (resumo?.bloqueadas ?? 0) + ' bloqueadas · visão completa'
    );

    if (state.selectedSlotId) {
      const vagaSelecionada = state.vagas.find((vaga) => vaga.id === state.selectedSlotId);
      if (vagaSelecionada?.status === 'ocupada' && vagaSelecionada.placa) {
        renderizarDetalhes(vagaSelecionada.placa);
      } else if (vagaSelecionada) {
        renderizarDetalhesVaga(vagaSelecionada);
      } else {
        state.selectedSlotId = null;
      }
    }
  }

  function formatarData(valor) {
    if (!valor) return '—';
    const data = new Date(valor);
    if (Number.isNaN(data.getTime())) return '—';
    return data.toLocaleString('pt-BR', { hour12: false });
  }

  function renderizarVeiculos(veiculos) {
    const seletor = $('#exitVehicle');
    const valorAnterior = seletor.value;
    seletor.replaceChildren();
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = veiculos.length ? 'Selecione a placa...' : 'Nenhum veículo estacionado';
    seletor.append(placeholder);

    veiculos.forEach((veiculo) => {
      const opcao = document.createElement('option');
      opcao.value = veiculo.placa;
      opcao.textContent = `${veiculo.placa} — ${veiculo.categoriaCliente} / ${veiculo.tipoVeiculo} / ${veiculo.vagaId || 'sem vaga'}`;
      seletor.append(opcao);
    });

    if (veiculos.some((veiculo) => veiculo.placa === valorAnterior)) seletor.value = valorAnterior;
    $('#duplicateEntryButton').disabled = veiculos.length === 0;
    atualizarCampoRecusa();
    if (seletor.value) {
      renderizarDetalhes(seletor.value);
    } else if (state.selectedSlotId) {
      const vaga = state.vagas.find((item) => item.id === state.selectedSlotId);
      if (vaga) renderizarDetalhesVaga(vaga);
      else renderizarDetalhes('');
    } else {
      renderizarDetalhes('');
    }
  }

  function atualizarCampoRecusa() {
    const placa = $('#exitVehicle').value;
    const veiculo = state.veiculos.find((item) => item.placa === placa);
    const mostrar = Boolean(veiculo && veiculo.categoriaCliente === 'avulso');
    $('#paymentRefusalField').classList.toggle('hidden', !mostrar);
    if (!mostrar) $('#paymentRefused').checked = false;
  }

  function criarDetalhe(rotulo, valor, cor) {
    const item = document.createElement('div');
    item.className = 'detail-item';
    const titulo = document.createElement('span');
    titulo.textContent = rotulo;
    const texto = document.createElement('strong');
    if (cor) {
      const amostra = document.createElement('i');
      amostra.className = 'vehicle-color';
      amostra.style.backgroundColor = cor;
      texto.append(amostra);
    }
    texto.append(document.createTextNode(valor == null || valor === '' ? '—' : String(valor)));
    item.append(titulo, texto);
    return item;
  }

  function renderizarDetalhes(placa) {
    const destino = $('#selectedVehicleDetails');
    destino.replaceChildren();
    const veiculo = state.veiculos.find((item) => item.placa === placa);
    if (!veiculo) {
      const vazio = document.createElement('p');
      vazio.className = 'empty-state';
      vazio.textContent = 'Selecione um veículo estacionado ou uma vaga no mapa.';
      destino.append(vazio);
      return;
    }

    const vaga = state.vagas.find((item) => item.id === veiculo.vagaId);
    state.selectedSlotId = vaga?.id ?? state.selectedSlotId;
    const cliente = state.clientes.find((item) =>
      item.veiculos?.some((veiculoCliente) => veiculoCliente.placa === placa)
    );
    const detalhes = document.createElement('div');
    detalhes.className = 'details-list';
    detalhes.append(
      criarDetalhe('Placa', veiculo.placa),
      criarDetalhe('Tipo', veiculo.tipoVeiculo),
      criarDetalhe('Cor', veiculo.corVeiculo, veiculo.corVeiculo),
      criarDetalhe('Cliente', veiculo.nomeCliente || 'Avulso'),
      criarDetalhe('Categoria', veiculo.categoriaCliente),
      criarDetalhe('Vaga', veiculo.vagaId),
      criarDetalhe('Entrada', formatarData(veiculo.dataHoraEntrada)),
      criarDetalhe('Credencial acessível', cliente?.possuiCredencialAcessibilidade ? 'SIM' : 'NÃO')
    );
    destino.append(detalhes);
  }

  function renderizarDetalhesVaga(vaga) {
    const destino = $('#selectedVehicleDetails');
    destino.replaceChildren();
    const detalhes = document.createElement('div');
    detalhes.className = 'details-list';
    detalhes.append(
      criarDetalhe('Identificador', vaga.id),
      criarDetalhe('Estado', String(vaga.status).toUpperCase()),
      criarDetalhe('Categoria', vaga.categoriaNome || vaga.categoriaId),
      criarDetalhe('Cor do setor', vaga.cor || '#A7ADB4', vaga.cor),
      criarDetalhe('Veículo', vaga.placa || 'Nenhum'),
      criarDetalhe('Tipo', vaga.tipoVeiculo || '—')
    );
    destino.append(detalhes);
  }

  function renderizarEventos(eventos) {
    const destino = $('#eventTerminal');
    destino.replaceChildren();
    definirTexto('terminalCount', `${eventos.length} EVENTOS RECENTES`);
    if (!eventos.length) {
      const vazio = document.createElement('p');
      vazio.className = 'empty-state';
      vazio.textContent = 'Nenhum evento foi registrado ainda.';
      destino.append(vazio);
      return;
    }

    eventos.forEach((evento) => {
      const linha = document.createElement('div');
      linha.className = 'event-row';
      const horario = document.createElement('span');
      horario.className = 'event-time';
      horario.textContent = formatarData(evento.timestamp).split(' ').slice(-1)[0] || '--:--:--';
      const principal = document.createElement('div');
      principal.className = 'event-main';
      const titulo = document.createElement('div');
      titulo.className = 'event-title';
      const tag = document.createElement('span');
      const resultado = String(evento.resultado || '').toLowerCase();
      tag.className = `event-tag ${['negado', 'recusado', 'bloqueado'].includes(resultado) ? 'denied' : ['alerta', 'pendente'].includes(resultado) ? 'alert' : ''} ${evento.origem === 'simulacao' ? 'sim' : ''}`;
      tag.textContent = evento.tipo || 'EVENTO';
      titulo.append(tag);
      if (evento.placa) {
        const placa = document.createElement('span');
        placa.textContent = evento.placa;
        titulo.append(placa);
      }
      const detalhes = document.createElement('div');
      detalhes.className = 'event-details';
      detalhes.textContent = evento.motivo || evento.detalhes || `Resultado: ${evento.resultado || 'registrado'} · Origem: ${evento.origem || 'sistema'}`;
      principal.append(titulo, detalhes);
      linha.append(horario, principal);
      destino.append(linha);
    });
  }

  function atualizarSimulacao(simulacao) {
    const estado = simulacao.estado || 'parado';
    const executando = estado === 'executando';
    const pausado = estado === 'pausado';
    const chip = $('#simStatus');
    chip.textContent = estado === 'executando' ? 'SIMULAÇÃO EXECUTANDO' : estado === 'pausado' ? 'SIMULAÇÃO PAUSADA' : 'SIMULAÇÃO PARADA';
    chip.className = `status-chip ${executando ? 'status-online' : pausado ? 'status-paused' : 'status-idle'}`;

    const ponto = $('#simulationStateDot');
    ponto.className = `state-dot ${executando ? 'state-running' : pausado ? 'state-paused' : ''}`;
    definirTexto('simulationStateText', estado.toUpperCase());
    definirTexto('simulationSpeedLabel', `${simulacao.velocidade || 1}×`);
    definirTexto('securityGuardStatus', executando ? 'MONITORANDO ENTRADAS' : pausado ? 'SIMULAÇÃO EM PAUSA' : 'AGUARDANDO MOVIMENTO');
    $('#simulationSpeed').value = String(simulacao.velocidade || 1);
    $('#simulationSpeed').disabled = estado === 'parado';
    const estatisticas = simulacao.estatisticas || {};
    definirTexto('simEntryCount', String(estatisticas.entradasAutorizadas || 0));
    definirTexto('simDeniedCount', String(estatisticas.entradasNegadas || 0));
    definirTexto('simExitCount', String(estatisticas.saidas || 0));

    $('#startSimulationButton').disabled = estado !== 'parado';
    $('#pauseSimulationButton').disabled = !executando;
    $('#resumeSimulationButton').disabled = !pausado;
    $('#stopSimulationButton').disabled = estado === 'parado';
    if (simulacao.ultimoErro) $('#simulationMessage').textContent = `Último erro: ${simulacao.ultimoErro}`;
    else $('#simulationMessage').textContent = `${simulacao.veiculosDaSimulacaoEstacionados || 0} veículo(s) colocados pelo simulador permanecem estacionados.`;
  }

  function preencherCategorias(configuracao) {
    const select = $('#generationCategory');
    select.replaceChildren();
    const aleatoria = document.createElement('option');
    aleatoria.value = '';
    aleatoria.textContent = 'Aleatória (pesos iguais)';
    select.append(aleatoria);

    (configuracao.perfisCliente || []).forEach((perfil) => {
      const opcao = document.createElement('option');
      opcao.value = perfil.id;
      opcao.textContent = perfil.nome;
      select.append(opcao);
    });
  }

  async function carregarTudo() {
    if (!state.configuracao) {
      const configuracaoResposta = await api('GET', '/api/configuracao');
      if (configuracaoResposta.configuracaoNecessaria || !configuracaoResposta.configuracao) {
        mostrarTelaConfiguracao();
        return;
      }
      state.configuracao = configuracaoResposta.configuracao;
    }

    mostrarPainel();
    const veiculosAnteriores = new Map(state.veiculos.map((veiculo) => [veiculo.placa, veiculo]));
    const [estado, vagas, veiculos, clientes, eventos, simulacao] = await Promise.all([
      api('GET', '/api/estado'),
      api('GET', '/api/vagas'),
      api('GET', '/api/veiculos/estacionados'),
      api('GET', '/api/clientes'),
      api('GET', '/api/eventos?limite=40'),
      api('GET', '/api/simulacao'),
    ]);

    state.vagas = vagas.vagas || [];
    state.veiculos = veiculos.veiculos || [];
    state.clientes = clientes.clientes || [];
    state.eventos = eventos.eventos || [];
    state.simulacao = simulacao;

    atualizarIndicadores(estado);
    renderizarVagas(state.vagas, vagas.resumo);
    renderizarVeiculos(state.veiculos);
    processarNovosEventos(state.eventos, veiculosAnteriores);
    renderizarEventos(state.eventos);
    atualizarSimulacao(simulacao);
    preencherCategorias(state.configuracao);
    state.ultimaAtualizacao = new Date();
    definirTexto('lastUpdatedLabel', `Última atualização: ${state.ultimaAtualizacao.toLocaleTimeString('pt-BR', { hour12: false })}`);
  }

  async function atualizarPainel(silencioso = false) {
    try {
      await carregarTudo();
      statusConexao(true);
      if (state.ultimaFalhaConexao && !silencioso) toast('Conexão com a API restabelecida.');
      state.ultimaFalhaConexao = false;
    } catch (erro) {
      statusConexao(false, erro.message);
      if (!state.ultimaFalhaConexao && !silencioso) toast(`Falha ao atualizar o painel: ${erro.message}`, 'error');
      state.ultimaFalhaConexao = true;
    }
  }

  function iniciarPolling() {
    if (state.polling !== null) window.clearInterval(state.polling);
    state.polling = window.setInterval(() => atualizarPainel(true), 1400);
  }

  async function executarAcao(metodo, rota, corpo, mensagemSucesso) {
    try {
      const resposta = await api(metodo, rota, corpo);
      toast(mensagemSucesso || resposta.mensagem || 'Operação concluída.');
      await atualizarPainel(true);
      return resposta;
    } catch (erro) {
      toast(erro.message, erro.status === 409 ? 'warning' : 'error');
      await atualizarPainel(true);
      return null;
    }
  }

  function registrarEventos() {
    $('#parkingCapacity').addEventListener('input', atualizarDistribuicao);
    $('#addCategoryButton').addEventListener('click', () => adicionarLinhaCategoria());
    $('#configurationForm').addEventListener('submit', enviarConfiguracao);

    $('#refreshButton').addEventListener('click', () => atualizarPainel(false));
    $('#entryForm').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const placa = $('#entryPlate').value.trim().toUpperCase();
      if (!placa) return;
      const resposta = await executarAcao('POST', '/api/entradas', { placa }, `Entrada autorizada para ${placa}.`);
      if (resposta) $('#entryPlate').value = '';
    });

    $('#exitVehicle').addEventListener('change', () => {
      atualizarCampoRecusa();
      state.selectedSlotId = state.vagas.find((vaga) => vaga.placa === $('#exitVehicle').value)?.id ?? null;
      if ($('#exitVehicle').value) renderizarDetalhes($('#exitVehicle').value);
      else renderizarDetalhes('');
      desenharMapa();
    });
    $('#mapCategoryFilter').addEventListener('change', () => desenharMapa());
    $('#parkingCanvas').addEventListener('click', selecionarVagaNoMapa);
    $('#parkingCanvas').addEventListener('mousemove', (evento) => {
      const canvas = $('#parkingCanvas');
      const limites = canvas.getBoundingClientRect();
      const x = (evento.clientX - limites.left) * (canvas.width / limites.width);
      const y = (evento.clientY - limites.top) * (canvas.height / limites.height);
      const caixa = state.mapHitBoxes.find((item) =>
        x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h
      );
      canvas.style.cursor = caixa ? 'pointer' : 'crosshair';
      canvas.title = caixa
        ? `${caixa.vaga.id} · ${caixa.vaga.status}${caixa.vaga.placa ? ` · ${caixa.vaga.placa}` : ''}`
        : 'Mapa top-down do estacionamento';
    });
    window.addEventListener('resize', () => window.requestAnimationFrame(desenharMapa));
    $('#exitForm').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const placa = $('#exitVehicle').value;
      if (!placa) {
        toast('Selecione um veículo estacionado.', 'warning');
        return;
      }
      const pagamentoRecusado = $('#paymentRefused').checked;
      const resposta = await executarAcao('POST', '/api/saidas', { placa, pagamentoRecusado },
        `Saída processada para ${placa}.`);
      if (resposta) $('#paymentRefused').checked = false;
    });

    $('#duplicateEntryButton').addEventListener('click', async () => {
      const placa = $('#exitVehicle').value;
      if (!placa) return;
      await executarAcao('POST', '/api/entradas', { placa }, 'A tentativa duplicada foi processada pelo backend.');
    });

    $('#generationForm').addEventListener('submit', async (evento) => {
      evento.preventDefault();
      const quantidade = Number($('#generationQuantity').value);
      const categoriaId = $('#generationCategory').value;
      const tipoVeiculo = $('#generationVehicleType').value;
      try {
        const resultado = await api('POST', '/api/clientes/gerar', {
          quantidade,
          ...(categoriaId ? { categoriaId } : {}),
          ...(tipoVeiculo ? { tipoVeiculo } : {}),
          origem: 'api',
        });
        definirTexto('generationResult',
          `${resultado.criados} cliente(s) criado(s) de ${resultado.solicitados}; ${resultado.quantidadeFalhas} falha(s). Nenhum veículo entrou automaticamente.`
        );
        toast(`Lote concluído: ${resultado.criados} cliente(s) criado(s).`);
        await atualizarPainel(true);
      } catch (erro) {
        definirTexto('generationResult', erro.message);
        toast(erro.message, 'error');
      }
    });

    $('#simulationSpeed').addEventListener('change', async (evento) => {
      await executarAcao('PUT', '/api/simulacao/velocidade', { velocidade: Number(evento.target.value) }, 'Velocidade da simulação atualizada.');
    });
    $('#startSimulationButton').addEventListener('click', async () => {
      const resultado = await executarAcao('POST', '/api/simulacao/iniciar', {
        velocidade: Number($('#simulationSpeed').value),
        intervaloChegadaMs: 1600,
        quantidadeVeiculos: Number($('#simulationFleetSize').value),
        permanenciaMinMs: 12000,
        permanenciaMaxMs: 26000,
      }, 'Simulação iniciada.');
      if (resultado) atualizarSimulacao(resultado);
    });
    $('#pauseSimulationButton').addEventListener('click', () => executarAcao('POST', '/api/simulacao/pausar', undefined, 'Simulação pausada.'));
    $('#resumeSimulationButton').addEventListener('click', () => executarAcao('POST', '/api/simulacao/retomar', undefined, 'Simulação retomada.'));
    $('#stopSimulationButton').addEventListener('click', async () => {
      if (!window.confirm('Encerrar a simulação? Os veículos colocados por ela receberão saída e as vagas serão liberadas.')) return;
      await executarAcao('POST', '/api/simulacao/encerrar', undefined, 'Simulação encerrada.');
    });
  }

  async function iniciar() {
    atualizarRelogio();
    window.setInterval(atualizarRelogio, 1000);
    registrarEventos();
    adicionarLinhaCategoria({ id: 'geral', quantidade: 100, cor: '#65A878' });

    try {
      const health = await api('GET', '/api/health');
      statusConexao(true);
      if (health.configuracaoNecessaria) {
        mostrarTelaConfiguracao();
      } else {
        const configuracao = await api('GET', '/api/configuracao');
        state.configuracao = configuracao.configuracao;
        preencherCategorias(state.configuracao);
        mostrarPainel();
        await atualizarPainel(true);
        iniciarPolling();
      }
    } catch (erro) {
      statusConexao(false, erro.message);
      mostrarTelaConfiguracao();
      $('#configurationError').textContent = `A API não está disponível: ${erro.message}`;
    }
  }

  iniciar();
})();
