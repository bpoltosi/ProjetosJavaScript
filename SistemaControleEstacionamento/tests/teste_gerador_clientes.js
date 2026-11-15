const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');

function randomComSemente(semente) {
  let estado = semente;
  return () => {
    estado = (estado * 9301 + 49297) % 233280;
    return estado / 233280;
  };
}

function criarConfiguracao() {
  return {
    versao: 1,
    nome: 'Estacionamento Gerador',
    capacidadeTotal: 30,
    categorias: [{
      id: 'geral',
      nome: 'Geral',
      quantidade: 30,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
    }],
    perfisCliente: [{
      id: 'funcionario',
      nome: 'Funcionário',
      classeDominio: 'personalizado',
      limitePlacas: 2,
      categoriasVagaPermitidas: ['geral'],
    }],
  };
}

function criarCaminhos(diretorio) {
  return {
    clientes: path.join(diretorio, 'clientes.csv'),
    tickets: path.join(diretorio, 'tickets.csv'),
    bloqueios: path.join(diretorio, 'bloqueios.csv'),
    veiculos: path.join(diretorio, 'veiculos.json'),
    vagas: path.join(diretorio, 'estado-vagas.json'),
    eventos: path.join(diretorio, 'eventos.jsonl'),
  };
}

function executar() {
  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-gerador-'));
  try {
    const configuracao = criarConfiguracao();
    const caminhos = criarCaminhos(diretorio);
    const app = new App(configuracao);
    app.carregarTudo(caminhos);
    app.geradorClientes.random = randomComSemente(19);

    const loteEstudantes = app.gerarClientes({
      quantidade: 3,
      categoriaId: 'estudante',
      tiposVeiculo: ['motocicleta', 'sedan', 'van'],
      coresVeiculo: ['#D94B4B', '#4477BB', '#E0B33F'],
      origem: 'manual',
    });
    assert.equal(loteEstudantes.solicitados, 3);
    assert.equal(loteEstudantes.criados, 3);
    assert.equal(loteEstudantes.quantidadeFalhas, 0);
    assert.ok(loteEstudantes.clientes.every((cliente) => cliente.categoriaId === 'estudante'));
    assert.ok(loteEstudantes.clientes.every((cliente) => cliente.veiculos.length === 1));
    assert.equal(new Set(loteEstudantes.clientes.map((cliente) => cliente.documento)).size, 3);
    assert.equal(new Set(loteEstudantes.clientes.flatMap((cliente) => cliente.veiculos.map((v) => v.placa))).size, 3);
    assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 0);
    console.log('✅ Geração por categoria cria N estudantes, documentos/placas únicos e não registra entradas.');

    const loteFuncionarios = app.gerarClientes({
      quantidade: 4,
      categoriaId: 'funcionario',
      veiculosPorCliente: 2,
      tipoVeiculo: 'van',
      coresVeiculo: ['#252525'],
      possuiCredencialAcessibilidade: true,
      origem: 'simulacao',
    });
    assert.equal(loteFuncionarios.criados, 4);
    assert.equal(loteFuncionarios.quantidadeFalhas, 0);
    assert.ok(loteFuncionarios.clientes.every((cliente) => cliente.categoriaId === 'funcionario'));
    assert.ok(loteFuncionarios.clientes.every((cliente) => cliente.veiculos.length === 2));
    assert.ok(loteFuncionarios.clientes.every((cliente) => cliente.possuiCredencialAcessibilidade));
    assert.ok(loteFuncionarios.clientes.every((cliente) => cliente.veiculos.every((v) => v.tipo === 'van' && v.cor === '#252525')));
    console.log('✅ Perfis personalizados respeitam limite de placas e aceitam tipo, cor e acessibilidade definidos.');

    const loteAleatorio = app.gerarClientes({
      quantidade: 30,
      pesosCategorias: { estudante: 1, professor: 2, empresa: 1, funcionario: 3 },
      tiposVeiculo: ['compacto', 'hatch', 'sedan', 'suv', 'picape', 'van', 'micro-onibus', 'motocicleta'],
      pesosTipos: {
        compacto: 1, hatch: 1, sedan: 1, suv: 1,
        picape: 1, van: 1, 'micro-onibus': 1, motocicleta: 1,
      },
      coresVeiculo: ['#D94B4B', '#4477BB', '#E0B33F', '#4E9666'],
      probabilidadeAcessibilidade: 0.25,
      origem: 'simulacao',
    });
    assert.equal(loteAleatorio.criados, 30);
    assert.equal(loteAleatorio.quantidadeFalhas, 0);
    assert.ok(Object.keys(loteAleatorio.distribuicaoCategorias).length > 1);
    assert.ok(Object.keys(loteAleatorio.distribuicaoTiposVeiculo).length > 1);
    assert.equal(new Set(app.listarClientes().map((cliente) => cliente.documento)).size, app.listarClientes().length);
    assert.equal(app.registroDeEntradasESaidas.ticketsAbertos.size, 0);
    console.log('✅ Geração aleatória usa pesos para categorias/tipos e mantém documentos únicos.');

    const totalAntesDaFalha = app.listarClientes().length;
    const loteComLimiteExcedido = app.gerarClientes({
      quantidade: 2,
      categoriaId: 'estudante',
      veiculosPorCliente: 2,
    });
    assert.equal(loteComLimiteExcedido.criados, 0);
    assert.equal(loteComLimiteExcedido.quantidadeFalhas, 2);
    assert.equal(app.listarClientes().length, totalAntesDaFalha);
    console.log('✅ Falha por limite de placas é reportada e remove o cadastro parcial sem deixar órfãos.');

    assert.throws(() => app.gerarClientes({ quantidade: 0 }), /entre 1 e 500/);
    assert.throws(() => app.gerarClientes({ quantidade: 1, categoriaId: 'nao-existe' }), /não encontrada/);
    assert.throws(() => app.gerarClientes({ quantidade: 1, tipoVeiculo: 'trator' }), /tiposVeiculo/);
    assert.throws(() => app.gerarClientes({ quantidade: 1, probabilidadeAcessibilidade: 1.5 }), /entre 0 e 1/);
    console.log('✅ Parâmetros fora do contrato são rejeitados antes da geração.');

    const appColisao = new App(configuracao);
    appColisao.geradorClientes.random = randomComSemente(7);
    const clienteExistente = new Estudante('00000000001', 'Cliente Existente', 25);
    appColisao.cadastrarCliente(clienteExistente);
    appColisao.registrarPlaca(clienteExistente.documento, 'SIM0A00');
    const loteSemColisao = appColisao.gerarClientes({
      quantidade: 5,
      categoriaId: 'estudante',
      tipoVeiculo: 'motocicleta',
    });
    assert.equal(loteSemColisao.criados, 5);
    assert.ok(loteSemColisao.clientes.every((cliente) => cliente.documento !== '00000000001'));
    const todasPlacas = appColisao.listarClientes().flatMap((cliente) => Array.from(cliente.placas.keys()));
    assert.equal(new Set(todasPlacas).size, todasPlacas.length);
    assert.equal(todasPlacas.filter((placa) => placa === 'SIM0A00').length, 1);
    assert.ok(loteSemColisao.clientes.every((cliente) => cliente.veiculos.every((veiculo) => veiculo.placa !== 'SIM0A00')));
    console.log('✅ O gerador evita colisões com documentos e placas já cadastrados.');

    const totalEventosGeracao = app.consultarEventos({ tipo: 'CLIENTE_GERADO' }).total;
    assert.equal(totalEventosGeracao, 37);
    assert.equal(app.consultarEventos({ origem: 'simulacao', tipo: 'VEICULO_GERADO' }).total, 8 + loteAleatorio.criados);
    app.salvarTudo(caminhos);

    const appRestaurado = new App(configuracao);
    appRestaurado.carregarTudo(caminhos);
    assert.equal(appRestaurado.listarClientes().length, app.listarClientes().length);
    assert.equal(appRestaurado.listarClientes().filter((cliente) => cliente.categoriaId === 'funcionario').length, 4);
    assert.equal(appRestaurado.listarClientes().find((cliente) => cliente.categoriaId === 'funcionario').constructor.name, 'ClientePersonalizado');
    assert.equal(appRestaurado.registroEventos.totalEventos(), app.registroEventos.totalEventos());
    assert.ok(appRestaurado.listarClientes().flatMap((cliente) => Array.from(cliente.placas.values())).every((veiculo) => veiculo.cor && veiculo.tipo));
    console.log('✅ Clientes personalizados e metadados visuais são persistidos e restaurados com a configuração.');

    const diretorioErro = path.join(diretorio, 'caminho-eventos-diretorio');
    fs.mkdirSync(diretorioErro);
    const appComFalhaDeLog = new App(configuracao);
    appComFalhaDeLog.registroEventos.caminho = diretorioErro;
    const resultadoErroLog = appComFalhaDeLog.gerarClientes({ quantidade: 1, categoriaId: 'estudante' });
    assert.equal(resultadoErroLog.criados, 0);
    assert.equal(resultadoErroLog.quantidadeFalhas, 1);
    assert.equal(appComFalhaDeLog.listarClientes().length, 0);
    console.log('✅ Falha ao persistir eventos desfaz o cliente/veículo recém-gerado.');
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste do gerador de clientes/veículos falhou:', erro);
  process.exitCode = 1;
}
