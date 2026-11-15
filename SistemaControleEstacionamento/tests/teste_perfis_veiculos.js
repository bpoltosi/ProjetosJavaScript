const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const ConfiguracaoEstacionamento = require('../src/configuracao/ConfiguracaoEstacionamento');
const Veiculo = require('../src/veiculos/Veiculo');

const configBase = {
  versao: 1,
  nome: 'Estacionamento de Teste',
  capacidadeTotal: 4,
  categorias: [
    { id: 'estudante', nome: 'Estudante', quantidade: 2, cor: '#4477BB' },
    { id: 'geral', nome: 'Geral', quantidade: 2, cor: '#4E9666' },
  ],
  perfisCliente: [
    { id: 'estudante', nome: 'Estudante', classeDominio: 'estudante', limitePlacas: 1, categoriasVagaPermitidas: ['estudante', 'geral'] },
    { id: 'funcionario', nome: 'Funcionário', classeDominio: 'personalizado', limitePlacas: 2, categoriasVagaPermitidas: ['geral'] },
    { id: 'visitante-acessivel', nome: 'Visitante com credencial de acessibilidade', classeDominio: 'personalizado', limitePlacas: null, categoriasVagaPermitidas: ['geral'] },
  ],
};

function criarCaminhos(diretorio) {
  return {
    clientes: path.join(diretorio, 'clientes.csv'),
    tickets: path.join(diretorio, 'tickets.csv'),
    bloqueios: path.join(diretorio, 'bloqueios.csv'),
    veiculos: path.join(diretorio, 'veiculos.json'),
  };
}

function executar() {
  const config = new ConfiguracaoEstacionamento(configBase);
  assert.equal(config.perfisCliente.length, 3);
  assert.equal(config.perfisCliente[1].classeDominio, 'personalizado');
  assert.deepEqual(config.perfisCliente[0].categoriasVagaPermitidas, ['estudante', 'geral']);
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configBase,
      perfisCliente: [{ ...configBase.perfisCliente[0], categoriasVagaPermitidas: ['categoria-inexistente'] }],
    }),
    /categoria de vaga inexistente/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configBase,
      perfisCliente: [configBase.perfisCliente[0], { ...configBase.perfisCliente[1], id: 'estudante' }],
    }),
    /id de perfil de cliente duplicado/
  );
  console.log('✅ Perfis de cliente permitem categorias próprias e validam as categorias de vagas permitidas.');

  assert.deepEqual(Veiculo.TIPOS, [
    'motocicleta', 'compacto', 'hatch', 'sedan', 'suv', 'picape', 'van', 'micro-onibus',
  ]);
  const moto = new Veiculo('mot1a23', { tipo: 'motocicleta', cor: '#111111' });
  assert.equal(moto.placa, 'MOT1A23');
  assert.equal(moto.comprimentoMetros, 2.1);
  assert.equal(moto.larguraMetros, 0.9);
  assert.equal(moto.cor, '#111111');
  assert.throws(() => new Veiculo('ABC1D23', { tipo: 'ônibus' }), /não suportado/);
  assert.throws(() => new Veiculo('ABC1D23', { cor: 'azul' }), /formato hexadecimal/);
  assert.throws(() => new Veiculo('ABC1D23', { comprimentoMetros: -1 }), /comprimentoMetros/);
  console.log('✅ Veículos validam tipo, cor e dimensões, mantendo defaults para registros antigos.');

  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-veiculos-'));
  try {
    const caminhos = criarCaminhos(diretorio);
    const app1 = new App();
    const estudante = new Estudante('11111111111', 'Ana Estudante');
    app1.cadastrarCliente(estudante);
    app1.registrarPlaca(estudante.documento, 'MOT1A23', {
      tipo: 'motocicleta',
      cor: '#D94B4B',
      comprimentoMetros: 2.2,
      larguraMetros: 0.95,
    });
    app1.salvarTudo(caminhos);

    const app2 = new App();
    app2.carregarTudo(caminhos);
    const clienteRestaurado = app2.buscarClientePorDocumento('11111111111');
    const veiculoRestaurado = clienteRestaurado.placas.get('MOT1A23');
    assert.equal(veiculoRestaurado.tipo, 'motocicleta');
    assert.equal(veiculoRestaurado.cor, '#D94B4B');
    assert.equal(veiculoRestaurado.comprimentoMetros, 2.2);
    assert.equal(veiculoRestaurado.larguraMetros, 0.95);
    assert.equal(clienteRestaurado.categoriaId, 'estudante');
    console.log('✅ Metadados de veículos são persistidos e restaurados sem alterar o CSV legado de clientes.');
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste de categorias/veículos falhou:', erro);
  process.exitCode = 1;
}
