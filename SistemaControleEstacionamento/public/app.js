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
    todosOsEspacos: false,
    mapPage: 0,
    mapPageSize: 80,
    mapVisibleSlots: [],
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

  function desenharSprite(ctx, veiculo, x, y, larguraMaxima, alturaMaxima) {
    const tipo = veiculo?.tipoVeiculo || 'sedan';
    const sprite = SPRITES[tipo] || SPRITES.sedan;
    const colunas = Math.max(...sprite.map((linha) => linha.length));
    const linhas = sprite.length;
    const pixel = Math.max(1, Math.floor(Math.min(2, larguraMaxima / colunas, alturaMaxima / linhas)));
    const largura = colunas * pixel;
    const altura = linhas * pixel;
    const inicioX = Math.floor(x - largura / 2);
    const inicioY = Math.floor(y - altura / 2);
    const body = corParaPixel(veiculo?.corVeiculo || veiculo?.cor, MAP_PALETTE.vehicleFallback || '#A7ADB4');

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

  function desenharFundoMapa(ctx, largura, altura) {
    ctx.fillStyle = MAP_PALETTE.asphalt || '#26372F';
    ctx.fillRect(0, 0, largura, altura);
    const textura = MAP_PALETTE.asphaltDots || [[8, 8], [18, 13], [12, 21], [25, 4]];
    for (let y = 40; y < altura; y += 28) {
      for (let x = 8; x < largura; x += 32) {
        textura.forEach(([dx, dy]) => {
          ctx.fillStyle = MAP_PALETTE.asphaltTile || '#2B3D34';
          ctx.fillRect(x + dx, y + dy, 2, 2);
        });
      }
    }

    ctx.fillStyle = MAP_PALETTE.header || '#17251F';
    ctx.fillRect(0, 0, largura, 36);
    ctx.fillStyle = MAP_PALETTE.headerText || '#AFCB9A';
    ctx.font = 'bold 9px "Lucida Console", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('ENTRADA ▶', 12, 22);
    ctx.textAlign = 'center';
    ctx.fillStyle = MAP_PALETTE.roadText || '#D8E4CF';
    ctx.fillText('PISTA DE CIRCULAÇÃO', largura / 2, 22);
    ctx.textAlign = 'right';
    ctx.fillText('SAÍDA ▶', largura - 12, 22);

    ctx.strokeStyle = MAP_PALETTE.roadStripe || '#E4D28A';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.moveTo(12, 30);
    ctx.lineTo(largura - 12, 30);
    ctx.stroke();
    ctx.setLineDash([]);

    // Guarita e cancela em blocos pixelados; representam a entrada física do pátio.
    ctx.fillStyle = '#526B59';
    ctx.fillRect(91, 6, 18, 24);
    ctx.fillStyle = '#A8C6A6';
    ctx.fillRect(95, 9, 10, 8);
    ctx.fillStyle = '#24352B';
    ctx.fillRect(94, 19, 12, 7);
    ctx.fillStyle = '#E6CE7E';
    ctx.fillRect(111, 13, 23, 3);
    ctx.fillStyle = '#B75E50';
    ctx.fillRect(111, 10, 4, 9);
    ctx.fillRect(130, 10, 4, 9);
  }

  function desenharVaga(ctx, vaga, caixa, selecionada, veiculo) {
    const status = vaga.status || 'livre';
    const estados = MAP_PALETTE.states || {};
    const cores = estados[status] || estados.livre || { fundo: '#294A35', borda: '#83B77D', texto: '#DCF0C8' };

    ctx.fillStyle = MAP_PALETTE.slotShadow || '#14221C';
    ctx.fillRect(caixa.x + 2, caixa.y + 3, caixa.w, caixa.h);
    ctx.fillStyle = cores.fundo;
    ctx.fillRect(caixa.x, caixa.y, caixa.w, caixa.h);
    ctx.strokeStyle = selecionada ? (MAP_PALETTE.selection || '#F4D273') : cores.borda;
    ctx.lineWidth = selecionada ? 3 : 2;
    ctx.strokeRect(caixa.x + 1, caixa.y + 1, caixa.w - 2, caixa.h - 2);

    ctx.fillStyle = cores.texto;
    ctx.font = 'bold 7px "Lucida Console", monospace';
    ctx.textAlign = 'left';
    ctx.fillText(vaga.id, caixa.x + 4, caixa.y + 9, caixa.w - 8);

    if (status === 'ocupada') {
      desenharSprite(ctx, veiculo || {
        tipoVeiculo: 'sedan',
        corVeiculo: '#A7ADB4',
      }, caixa.x + caixa.w / 2, caixa.y + caixa.h / 2 + 3, caixa.w - 12, caixa.h - 20);
      ctx.fillStyle = '#E8F2F0';
      ctx.font = 'bold 6px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(vaga.placa || 'OCUPADA', caixa.x + caixa.w / 2, caixa.y + caixa.h - 4, caixa.w - 4);
    } else if (status === 'bloqueada') {
      ctx.strokeStyle = '#F3A39B';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(caixa.x + 9, caixa.y + 19);
      ctx.lineTo(caixa.x + caixa.w - 9, caixa.y + caixa.h - 8);
      ctx.moveTo(caixa.x + caixa.w - 9, caixa.y + 19);
      ctx.lineTo(caixa.x + 9, caixa.y + caixa.h - 8);
      ctx.stroke();
      ctx.fillStyle = cores.texto;
      ctx.font = 'bold 6px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BLOQUEADA', caixa.x + caixa.w / 2, caixa.y + caixa.h - 4, caixa.w - 4);
    } else {
      ctx.fillStyle = '#A8D190';
      ctx.fillRect(caixa.x + caixa.w / 2 - 2, caixa.y + 22, 4, 4);
      ctx.fillStyle = cores.texto;
      ctx.font = 'bold 6px "Lucida Console", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('LIVRE', caixa.x + caixa.w / 2, caixa.y + caixa.h - 5);
    }
  }

  function desenharMapa() {
    const canvas = $('#parkingCanvas');
    const shell = $('#canvasShell');
    if (!canvas || !shell) return;

    const largura = Math.max(300, Math.floor(shell.clientWidth - 4));
    const filtro = $('#mapCategoryFilter')?.value || '';
    const filtradas = vagasDoMapa();
    const paginas = Math.max(1, Math.ceil(filtradas.length / state.mapPageSize));
    state.mapPage = Math.min(state.mapPage, paginas - 1);
    const inicio = state.mapPage * state.mapPageSize;
    const visiveis = filtradas.slice(inicio, inicio + state.mapPageSize);
    state.mapVisibleSlots = visiveis;

    const grupos = agruparVagasPorCategoria(visiveis);
    const margem = 14;
    const colunas = Math.max(3, Math.min(8, Math.floor((largura - 44) / 88)));
    const espacamentoX = 9;
    const espacamentoY = 8;
    const slotW = Math.max(28, Math.floor((largura - margem * 2 - espacamentoX * (colunas - 1)) / colunas));
    const slotH = 58;
    let cursorY = 51;
    const caixas = [];

    grupos.forEach((grupo) => {
      cursorY += 8;
      const topoGrupo = cursorY;
      cursorY += 19;
      grupo.vagas.forEach((vaga, indice) => {
        const linha = Math.floor(indice / colunas);
        const coluna = indice % colunas;
        const faixaCirculacao = Math.floor(linha / 2) * 18;
        const y = cursorY + linha * (slotH + espacamentoY) + faixaCirculacao;
        const x = margem + coluna * (slotW + espacamentoX);
        caixas.push({
          vaga,
          x,
          y,
          w: slotW,
          h: slotH,
          topoGrupo,
          grupoId: grupo.id,
        });
      });
      const linhas = Math.ceil(grupo.vagas.length / colunas);
      const faixasCirculacao = Math.floor(Math.max(0, linhas - 1) / 2);
      cursorY += linhas * (slotH + espacamentoY) + faixasCirculacao * 18 + 18;
    });

    const altura = Math.max(260, cursorY + 20);
    canvas.width = largura;
    canvas.height = altura;
    canvas.style.height = `${altura}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    desenharFundoMapa(ctx, largura, altura);

    grupos.forEach((grupo) => {
      const caixasGrupo = caixas.filter((caixa) => caixa.grupoId === grupo.id);
      if (!caixasGrupo.length) return;
      const topo = Math.min(...caixasGrupo.map((caixa) => caixa.y)) - 15;
      const fundo = Math.max(...caixasGrupo.map((caixa) => caixa.y + caixa.h)) + 7;
      ctx.fillStyle = '#1C2A23';
      ctx.fillRect(7, topo, largura - 14, fundo - topo);
      ctx.strokeStyle = grupo.cor;
      ctx.lineWidth = 1;
      ctx.strokeRect(7, topo, largura - 14, fundo - topo);

      const linhasGrupo = Array.from(new Set(caixasGrupo.map((caixa) => caixa.y))).sort((a, b) => a - b);
      for (let indiceLinha = 1; indiceLinha < linhasGrupo.length; indiceLinha += 1) {
        if (indiceLinha % 2 !== 0) continue;
        const faixaY = Math.floor((linhasGrupo[indiceLinha - 1] + slotH + linhasGrupo[indiceLinha]) / 2);
        ctx.fillStyle = '#34483E';
        ctx.fillRect(10, faixaY - 5, largura - 20, 13);
        ctx.strokeStyle = '#B2C69A';
        ctx.lineWidth = 1;
        ctx.setLineDash([6, 7]);
        ctx.beginPath();
        ctx.moveTo(17, faixaY + 1);
        ctx.lineTo(largura - 17, faixaY + 1);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = '#D9E5D0';
        ctx.font = 'bold 6px "Lucida Console", monospace';
        ctx.textAlign = 'right';
        ctx.fillText('PISTA', largura - 22, faixaY - 7);
      }

      ctx.fillStyle = grupo.cor;
      ctx.font = 'bold 9px "Lucida Console", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`SETOR ${grupo.nome.toUpperCase()} · ${grupo.vagas.length} VAGA(S)`, 13, topo - 4);
    });

    const veiculosPorPlaca = new Map(state.veiculos.map((veiculo) => [veiculo.placa, veiculo]));
    state.mapHitBoxes = caixas;
    caixas.forEach((caixa) => {
      const selecionada = state.selectedSlotId === caixa.vaga.id;
      const veiculo = caixa.vaga.placa ? veiculosPorPlaca.get(caixa.vaga.placa) : null;
      desenharVaga(ctx, caixa.vaga, caixa, selecionada, veiculo);
    });

    ctx.fillStyle = MAP_PALETTE.roadText || '#D8E6D1';
    ctx.font = 'bold 8px "Lucida Console", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(`PÁGINA ${state.mapPage + 1}/${paginas}`, largura - 13, altura - 7);

    definirTexto('mapPageLabel', `PÁGINA ${state.mapPage + 1} / ${paginas} · ${filtradas.length} VAGAS`);
    $('#mapPrevPage').disabled = state.mapPage <= 0;
    $('#mapNextPage').disabled = state.mapPage >= paginas - 1;
    definirTexto('mapCaption', filtro
      ? `Setor filtrado: ${filtro}. Clique numa vaga para ver seu estado e seus dados.`
      : 'Mapa top-down ortográfico. Cada marcação corresponde a uma vaga real da API; clique para ver detalhes.');
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


  function criarVaga(vaga) {
    const elemento = document.createElement('div');
    const status = vaga.status || 'livre';
    elemento.className = `vacancy-cell vacancy-${status === 'ocupada' ? 'occupied' : status === 'bloqueada' ? 'blocked' : 'free'}`;
    elemento.title = `${vaga.id} · ${vaga.categoriaNome || vaga.categoriaId} · ${status}${vaga.placa ? ` · ${vaga.placa}` : ''}`;
    const id = document.createElement('span');
    id.textContent = vaga.id;
    elemento.append(id);
    const statusLabel = document.createElement('small');
    statusLabel.textContent = status === 'ocupada' ? (vaga.placa || 'OCUPADA') : status.toUpperCase();
    elemento.append(statusLabel);
    return elemento;
  }

  function renderizarVagas(vagas, resumo) {
    const grade = $('#vacancyGrid');
    grade.replaceChildren();
    const limite = state.todosOsEspacos ? vagas.length : Math.min(vagas.length, 48);
    vagas.slice(0, limite).forEach((vaga) => grade.append(criarVaga(vaga)));
    if (vagas.length === 0) {
      const vazio = document.createElement('p');
      vazio.className = 'empty-state';
      vazio.textContent = 'Nenhuma vaga retornada pelo backend.';
      grade.append(vazio);
    }
    const ocultas = Math.max(0, vagas.length - limite);
    definirTexto('vacancySummary',
      `${resumo?.total ?? vagas.length} vagas · ${resumo?.livres ?? 0} livres · ${resumo?.ocupadas ?? 0} ocupadas · ${resumo?.bloqueadas ?? 0} bloqueadas${ocultas ? ` · ${ocultas} ocultas` : ''}`
    );
    $('#showAllVacanciesButton').textContent = state.todosOsEspacos ? 'MOSTRAR MENOS' : 'VER TODAS';
    $('#showAllVacanciesButton').disabled = vagas.length <= 48;
    preencherFiltroMapa(state.configuracao);
    desenharMapa();

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
    state.polling = window.setInterval(() => atualizarPainel(true), 2500);
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
    $('#mapCategoryFilter').addEventListener('change', () => {
      state.mapPage = 0;
      desenharMapa();
    });
    $('#mapPrevPage').addEventListener('click', () => {
      state.mapPage = Math.max(0, state.mapPage - 1);
      desenharMapa();
    });
    $('#mapNextPage').addEventListener('click', () => {
      state.mapPage += 1;
      desenharMapa();
    });
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

    $('#showAllVacanciesButton').addEventListener('click', () => {
      state.todosOsEspacos = !state.todosOsEspacos;
      renderizarVagas(state.vagas, {
        total: state.vagas.length,
        livres: state.vagas.filter((vaga) => vaga.status === 'livre').length,
        ocupadas: state.vagas.filter((vaga) => vaga.status === 'ocupada').length,
        bloqueadas: state.vagas.filter((vaga) => vaga.status === 'bloqueada').length,
      });
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
        intervaloChegadaMs: 5000,
        quantidadeVeiculos: 12,
        permanenciaMinMs: 8000,
        permanenciaMaxMs: 30000,
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
