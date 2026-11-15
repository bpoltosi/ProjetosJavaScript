const path = require('node:path');
const express = require('express');

const App = require('./src/App');
const ConfiguracaoJson = require('./src/persistencia/ConfiguracaoJson');
const Estudante = require('./src/clientes/Estudante');
const Professor = require('./src/clientes/Professor');
const Empresa = require('./src/clientes/Empresa');
const ConfiguracaoEstacionamento = require('./src/configuracao/ConfiguracaoEstacionamento');
const GerenciadorVagas = require('./src/estacionamento/GerenciadorVagas');

function criarCaminhos(diretorioDados) {
  return {
    clientes: path.join(diretorioDados, 'clientes.csv'),
    tickets: path.join(diretorioDados, 'tickets.csv'),
    bloqueios: path.join(diretorioDados, 'bloqueios.csv'),
    veiculos: path.join(diretorioDados, 'veiculos.json'),
    vagas: path.join(diretorioDados, 'estado-vagas.json'),
    eventos: path.join(diretorioDados, 'eventos.jsonl'),
  };
}

function exigirCampo(condicao, mensagem, statusCode = 400) {
  if (!condicao) {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    throw erro;
  }
}

function resumirCliente(cliente) {
  const resumo = {
    documento: cliente.documento,
    nome: cliente.nome,
    categoriaId: cliente.categoriaId,
    possuiCredencialAcessibilidade: cliente.possuiCredencialAcessibilidade === true,
    veiculos: Array.from(cliente.placas.values()).map((veiculo) => veiculo.toJSON()),
  };

  if (typeof cliente.saldo === 'number') resumo.saldo = cliente.saldo;
  if (typeof cliente.saldoDevedor === 'number') resumo.saldoDevedor = cliente.saldoDevedor;
  if (typeof cliente.inadimplente === 'boolean') resumo.inadimplente = cliente.inadimplente;
  return resumo;
}

function resumirTicket(ticket) {
  return {
    placa: ticket.placa,
    vagaId: ticket.vagaId,
    dataHoraEntrada: ticket.dataHoraEntrada.toISOString(),
    dataHoraSaida: ticket.dataHoraSaida ? ticket.dataHoraSaida.toISOString() : null,
    custoOriginal: ticket.custoOriginal,
    descontoId: ticket.descontoId,
    valorDesconto: ticket.valorDesconto,
    valorDevido: ticket.valorDevido,
    valorPago: ticket.valorPago,
  };
}

function statusDoErro(erro) {
  if (Number.isInteger(erro.statusCode)) return erro.statusCode;
  const mensagem = String(erro.message ?? '').toLowerCase();

  if (mensagem.includes('não encontrado') || mensagem.includes('não existe')) return 404;
  if (
    mensagem.includes('inválid') ||
    mensagem.includes('deve ser') ||
    mensagem.includes('deve estar') ||
    mensagem.includes('informe ') ||
    mensagem.includes('precisa ser')
  ) return 400;
  if (
    mensagem.includes('já ') ||
    mensagem.includes('ocupad') ||
    mensagem.includes('bloquead') ||
    mensagem.includes('lotado') ||
    mensagem.includes('não está') ||
    mensagem.includes('não há vaga') ||
    mensagem.includes('não é possível') ||
    mensagem.includes('não autorizada')
  ) return 409;
  return 500;
}

function criarServidor(opcoes = {}) {
  const diretorioDados = opcoes.diretorioDados ??
    process.env.ESTACIONAMENTO_DIR_DADOS ??
    path.join(__dirname, 'data');
  const caminhoConfiguracao = opcoes.caminhoConfiguracao ??
    process.env.ESTACIONAMENTO_CONFIG ??
    path.join(__dirname, 'config', 'estacionamento.json');
  const caminhos = criarCaminhos(diretorioDados);

  const configuracao = Object.prototype.hasOwnProperty.call(opcoes, 'configuracao')
    ? opcoes.configuracao
    : ConfiguracaoJson.carregar(caminhoConfiguracao);

  const estacionamento = opcoes.estacionamento ?? new App(configuracao);
  if (!opcoes.estacionamento) estacionamento.carregarTudo(caminhos);

  const httpApp = express();
  httpApp.disable('x-powered-by');
  httpApp.use(express.json({ limit: '100kb' }));
  httpApp.use(express.static(path.join(__dirname, 'public')));

  httpApp.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      servico: 'SistemaControleEstacionamento',
      configuracaoNecessaria: !estacionamento.configuracao,
      timestamp: new Date().toISOString(),
    });
  });

  httpApp.get('/api/configuracao', (req, res) => {
    res.json({
      configuracao: estacionamento.configuracao?.toJSON?.() ?? null,
      configuracaoNecessaria: !estacionamento.configuracao,
    });
  });

  httpApp.put('/api/configuracao', (req, res) => {
    exigirCampo(
      estacionamento.registroDeEntradasESaidas.ticketsAbertos.size === 0,
      'não é possível alterar a configuração enquanto houver veículos estacionados',
      409
    );
    exigirCampo(
      !estacionamento.gerenciadorVagas ||
        estacionamento.gerenciadorVagas.listarVagas({ status: 'bloqueada' }).length === 0,
      'desbloqueie todas as vagas antes de alterar a configuração',
      409
    );

    const novaConfiguracao = new ConfiguracaoEstacionamento(req.body);
    // Persiste antes de trocar a configuração em memória: falha de disco
    // mantém o estado anterior ativo.
    const persistida = ConfiguracaoJson.salvar(caminhoConfiguracao, novaConfiguracao);
    const novoGerenciador = new GerenciadorVagas(persistida);
    estacionamento.configuracao = persistida;
    estacionamento.gerenciadorVagas = novoGerenciador;
    estacionamento.registroDeEntradasESaidas.gerenciadorVagas = novoGerenciador;

    res.status(200).json({
      mensagem: 'Configuração do estacionamento salva.',
      configuracao: persistida.toJSON(),
    });
  });

  httpApp.get('/api/estado', (req, res) => {
    const resumoVagas = estacionamento.resumoVagas();
    const ticketsAbertos = estacionamento.registroDeEntradasESaidas.ticketsAbertos;
    res.json({
      nomeEstacionamento: estacionamento.configuracao?.nome ?? null,
      configurado: Boolean(estacionamento.configuracao),
      capacidadeTotal: resumoVagas?.total ?? null,
      vagas: resumoVagas,
      veiculosEstacionados: ticketsAbertos.size,
      clientesCadastrados: estacionamento.listarClientes().length,
      eventosRegistrados: estacionamento.registroEventos.totalEventos(),
    });
  });

  httpApp.get('/api/vagas', (req, res) => {
    res.json({
      vagas: estacionamento.listarVagas({
        categoriaId: req.query.categoriaId,
        status: req.query.status,
      }),
      resumo: estacionamento.resumoVagas(),
    });
  });

  httpApp.get('/api/veiculos/estacionados', (req, res) => {
    const veiculos = Array.from(estacionamento.registroDeEntradasESaidas.ticketsAbertos.values())
      .map((ticket) => {
        const cliente = estacionamento.buscarClientePorPlaca(ticket.placa);
        const veiculo = cliente?.placas.get(ticket.placa) ?? null;
        const vaga = estacionamento.gerenciadorVagas?.buscarPorPlaca(ticket.placa) ?? null;

        return {
          ...resumirTicket(ticket),
          tipoVeiculo: veiculo?.tipo ?? vaga?.tipoVeiculo ?? 'sedan',
          corVeiculo: veiculo?.cor ?? '#A7ADB4',
          comprimentoMetros: veiculo?.comprimentoMetros ?? null,
          larguraMetros: veiculo?.larguraMetros ?? null,
          categoriaCliente: cliente?.categoriaId ?? 'avulso',
          nomeCliente: cliente?.nome ?? null,
          vaga,
        };
      });

    res.json({ veiculos, total: veiculos.length });
  });

  httpApp.get('/api/clientes', (req, res) => {
    const clientes = estacionamento.listarClientes().map(resumirCliente);
    res.json({ clientes, total: clientes.length });
  });

  httpApp.get('/api/clientes/:documento', (req, res) => {
    const cliente = estacionamento.buscarClientePorDocumento(req.params.documento);
    exigirCampo(cliente, 'cliente não encontrado', 404);
    res.json({ cliente: resumirCliente(cliente) });
  });

  httpApp.get('/api/eventos', (req, res) => {
    const inteiro = (valor, padrao) => valor === undefined ? padrao : Number(valor);
    const resultado = estacionamento.consultarEventos({
      placa: req.query.placa,
      tipo: req.query.tipo,
      origem: req.query.origem,
      desde: req.query.desde,
      ate: req.query.ate,
      pagina: inteiro(req.query.pagina, 1),
      limite: inteiro(req.query.limite, 50),
    });
    res.json(resultado);
  });

  httpApp.post('/api/clientes', (req, res) => {
    const { tipo, documento, nome, saldo, possuiCredencialAcessibilidade } = req.body ?? {};
    exigirCampo(typeof documento === 'string' && documento.trim() !== '', 'documento deve ser informado');
    exigirCampo(typeof nome === 'string' && nome.trim() !== '', 'nome deve ser informado');

    let cliente;
    switch (String(tipo ?? '').toLowerCase()) {
      case 'estudante':
        exigirCampo(saldo === undefined || (typeof saldo === 'number' && Number.isFinite(saldo)), 'saldo deve ser numérico');
        cliente = new Estudante(documento.trim(), nome.trim(), saldo ?? 0);
        break;
      case 'professor':
        cliente = new Professor(documento.trim(), nome.trim());
        break;
      case 'empresa':
        cliente = new Empresa(documento.trim(), nome.trim());
        break;
      default:
        exigirCampo(false, 'tipo deve ser estudante, professor ou empresa');
    }

    if (possuiCredencialAcessibilidade !== undefined) {
      cliente.definirCredencialAcessibilidade(possuiCredencialAcessibilidade);
    }
    estacionamento.cadastrarCliente(cliente);
    res.status(201).json({ cliente: resumirCliente(cliente) });
  });

  httpApp.post('/api/clientes/:documento/veiculos', (req, res) => {
    const cliente = estacionamento.buscarClientePorDocumento(req.params.documento);
    exigirCampo(cliente, 'cliente não encontrado', 404);

    const { placa, tipo, cor, comprimentoMetros, larguraMetros, possuiCredencialAcessibilidade } = req.body ?? {};
    exigirCampo(typeof placa === 'string' && placa.trim() !== '', 'placa deve ser informada');
    exigirCampo(
      possuiCredencialAcessibilidade === undefined || typeof possuiCredencialAcessibilidade === 'boolean',
      'possuiCredencialAcessibilidade deve ser booleano'
    );
    estacionamento.registrarPlaca(cliente.documento, placa, {
      ...(tipo === undefined ? {} : { tipo }),
      ...(cor === undefined ? {} : { cor }),
      ...(comprimentoMetros === undefined ? {} : { comprimentoMetros }),
      ...(larguraMetros === undefined ? {} : { larguraMetros }),
    });

    if (possuiCredencialAcessibilidade !== undefined) {
      cliente.definirCredencialAcessibilidade(possuiCredencialAcessibilidade);
    }
    const veiculo = cliente.placas.get(placa.trim().toUpperCase());
    res.status(201).json({ cliente: resumirCliente(cliente), veiculo: veiculo.toJSON() });
  });

  httpApp.put('/api/clientes/:documento/acessibilidade', (req, res) => {
    const cliente = estacionamento.buscarClientePorDocumento(req.params.documento);
    exigirCampo(cliente, 'cliente não encontrado', 404);
    exigirCampo(typeof req.body?.possuiCredencialAcessibilidade === 'boolean',
      'possuiCredencialAcessibilidade deve ser booleano');

    cliente.definirCredencialAcessibilidade(req.body.possuiCredencialAcessibilidade);
    res.json({ cliente: resumirCliente(cliente) });
  });

  httpApp.post('/api/entradas', (req, res) => {
    const placa = req.body?.placa;
    exigirCampo(typeof placa === 'string' && placa.trim() !== '', 'placa deve ser informada');
    const ticket = estacionamento.autorizarEntrada(placa, { origem: 'api' });
    res.status(201).json({
      mensagem: 'Entrada autorizada.',
      ticket: resumirTicket(ticket),
      vaga: ticket.vagaId ? estacionamento.gerenciadorVagas.buscarPorId(ticket.vagaId) : null,
    });
  });

  httpApp.post('/api/saidas', (req, res) => {
    const placa = req.body?.placa;
    exigirCampo(typeof placa === 'string' && placa.trim() !== '', 'placa deve ser informada');
    exigirCampo(
      req.body?.pagamentoRecusado === undefined || typeof req.body.pagamentoRecusado === 'boolean',
      'pagamentoRecusado deve ser booleano'
    );

    const ticket = estacionamento.processarSaida(placa, {
      pagamentoRecusado: req.body.pagamentoRecusado === true,
      origem: 'api',
    });
    res.json({ mensagem: 'Saída processada.', ticket: resumirTicket(ticket) });
  });

  httpApp.post('/api/vagas/:id/bloquear', (req, res) => {
    const vaga = estacionamento.bloquearVaga(req.params.id, { origem: 'api' });
    res.json({ mensagem: 'Vaga bloqueada.', vaga });
  });

  httpApp.post('/api/vagas/:id/desbloquear', (req, res) => {
    const vaga = estacionamento.desbloquearVaga(req.params.id, { origem: 'api' });
    res.json({ mensagem: 'Vaga desbloqueada.', vaga });
  });

  httpApp.use('/api', (req, res) => {
    res.status(404).json({ erro: { mensagem: 'Rota da API não encontrada.' } });
  });

  httpApp.use((erro, req, res, next) => {
    if (res.headersSent) return next(erro);
    const status = erro.type === 'entity.parse.failed' ? 400 : statusDoErro(erro);
    const mensagem = status === 500 ? 'Erro interno ao processar a solicitação.' : erro.message;
    if (status === 500) console.error('Erro na API:', erro);
    res.status(status).json({
      erro: {
        mensagem,
        codigo: status === 400 ? 'VALIDACAO' :
          status === 404 ? 'NAO_ENCONTRADO' :
          status === 409 ? 'CONFLITO' : 'ERRO_INTERNO',
      },
    });
  });

  return { httpApp, estacionamento, caminhos, caminhoConfiguracao };
}

function iniciarServidor() {
  const instancia = criarServidor();
  const host = process.env.ESTACIONAMENTO_HOST ?? '127.0.0.1';
  const porta = Number(process.env.PORT ?? process.env.ESTACIONAMENTO_PORTA ?? 3000);

  if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
    throw new Error('ESTACIONAMENTO_PORTA deve ser um inteiro entre 0 e 65535');
  }

  const servidor = instancia.httpApp.listen(porta, host, () => {
    const endereco = servidor.address();
    console.log(`Sistema de Estacionamento disponível em http://${host}:${endereco.port}`);
  });

  let encerrando = false;
  const encerrar = (sinal) => {
    if (encerrando) return;
    encerrando = true;
    console.log(`\nRecebido ${sinal}; encerrando servidor e salvando dados...`);
    servidor.close(() => {
      try {
        instancia.estacionamento.salvarTudo(instancia.caminhos);
        console.log('Dados salvos. Servidor encerrado.');
        process.exit(0);
      } catch (erro) {
        console.error(`Falha ao salvar dados durante encerramento: ${erro.message}`);
        process.exit(1);
      }
    });
  };

  process.on('SIGINT', () => encerrar('SIGINT'));
  process.on('SIGTERM', () => encerrar('SIGTERM'));
  return { ...instancia, servidor };
}

if (require.main === module) {
  try {
    iniciarServidor();
  } catch (erro) {
    console.error(`Não foi possível iniciar o servidor: ${erro.message}`);
    process.exitCode = 1;
  }
}

module.exports = { criarServidor, iniciarServidor, criarCaminhos };
