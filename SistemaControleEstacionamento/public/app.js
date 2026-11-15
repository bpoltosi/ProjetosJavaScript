(() => {
  'use strict';

  const $ = (seletor) => document.querySelector(seletor);
  const TIPOS_VEICULO = [
    'motocicleta', 'compacto', 'hatch', 'sedan',
    'suv', 'picape', 'van', 'micro-onibus',
  ];

  const state = {
    configuracao: null,
    vagas: [],
    veiculos: [],
    clientes: [],
    eventos: [],
    simulacao: null,
    todosOsEspacos: false,
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

  function adicionarLinhaCategoria(dados = {}) {
    const modelo = $('#categoryRowTemplate');
    const linha = modelo.content.firstElementChild.cloneNode(true);
    linha.querySelector('[data-field="id"]').value = dados.id ?? '';
    linha.querySelector('[data-field="nome"]').value = dados.nome ?? '';
    linha.querySelector('[data-field="quantidade"]').value = dados.quantidade ?? 1;
    linha.querySelector('[data-field="cor"]').value = dados.cor ?? '#65a878';
    linha.querySelector('[data-field="acessibilidade"]').checked = dados.requerAcessibilidade === true;

    linha.querySelectorAll('input').forEach((entrada) => {
      entrada.addEventListener('input', atualizarDistribuicao);
      entrada.addEventListener('change', atualizarDistribuicao);
    });
    linha.querySelector('.remove-category').addEventListener('click', () => {
      if ($('#categoryRows').children.length <= 1) {
        toast('O estacionamento precisa ter ao menos uma categoria de vaga.', 'warning');
        return;
      }
      linha.remove();
      atualizarDistribuicao();
    });

    $('#categoryRows').append(linha);
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
      const id = linha.querySelector('[data-field="id"]').value.trim().toLowerCase();
      const categoriaNome = linha.querySelector('[data-field="nome"]').value.trim();
      const quantidade = Number(linha.querySelector('[data-field="quantidade"]').value);
      const cor = linha.querySelector('[data-field="cor"]').value.toUpperCase();
      const requerAcessibilidade = linha.querySelector('[data-field="acessibilidade"]').checked;

      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
        throw new Error('O ID de cada categoria deve usar letras minúsculas, números e hífens.');
      }
      if (!categoriaNome) throw new Error(`Informe o nome da categoria "${id}".`);
      if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
        throw new Error(`A quantidade de vagas da categoria "${categoriaNome}" deve ser um inteiro positivo.`);
      }

      return {
        id,
        nome: categoriaNome,
        quantidade,
        cor,
        criteriosElegibilidade: { categoriasCliente: ['*'], requerAcessibilidade },
        tiposVeiculoPermitidos: TIPOS_VEICULO,
        dimensoesMaximas: null,
      };
    });

    if (categorias.length === 0) throw new Error('Adicione ao menos uma categoria de vagas.');
    const ids = categorias.map((categoria) => categoria.id);
    if (new Set(ids).size !== ids.length) throw new Error('Os IDs das categorias não podem se repetir.');
    const nomes = categorias.map((categoria) => categoria.nome.toLocaleLowerCase('pt-BR'));
    if (new Set(nomes).size !== nomes.length) throw new Error('Os nomes das categorias não podem se repetir.');

    const soma = categorias.reduce((total, categoria) => total + categoria.quantidade, 0);
    if (soma !== capacidadeTotal) {
      throw new Error(`A distribuição soma ${soma} vaga(s), mas a capacidade informada é ${capacidadeTotal}.`);
    }

    return {
      versao: 1,
      nome,
      capacidadeTotal,
      categorias,
      perfisCliente: [
        { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: ['*'] },
        { id: 'professor', nome: 'Professor', classeDominio: 'professor', limitePlacas: 2, categoriasVagaPermitidas: ['*'] },
        { id: 'empresa', nome: 'Empresa', classeDominio: 'empresa', limitePlacas: null, categoriasVagaPermitidas: ['*'] },
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
    renderizarDetalhes(seletor.value);
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
      vazio.textContent = 'Selecione um veículo estacionado para ver seus detalhes.';
      destino.append(vazio);
      return;
    }

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

    $('#exitVehicle').addEventListener('change', atualizarCampoRecusa);
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
    adicionarLinhaCategoria({ id: 'geral', nome: 'Geral', quantidade: 80, cor: '#65a878' });
    adicionarLinhaCategoria({ id: 'acessivel', nome: 'Acessível', quantidade: 20, cor: '#e0b33f', requerAcessibilidade: true });

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
