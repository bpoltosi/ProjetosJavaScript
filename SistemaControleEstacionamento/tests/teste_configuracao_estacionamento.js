const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ConfiguracaoEstacionamento = require('../src/configuracao/ConfiguracaoEstacionamento');
const ConfiguracaoJson = require('../src/persistencia/ConfiguracaoJson');

const configuracaoValida = {
  versao: 1,
  nome: '  Estacionamento Central  ',
  capacidadeTotal: 6,
  categorias: [
    {
      id: 'estudante',
      nome: 'Estudante',
      quantidade: 2,
      cor: '#4D91D1',
      criteriosElegibilidade: { categoriasCliente: ['estudante'] },
      tiposVeiculoPermitidos: ['compacto', 'sedan', 'motocicleta'],
    },
    {
      id: 'geral',
      nome: 'Geral',
      quantidade: 3,
      cor: '#65A878',
      criteriosElegibilidade: { categoriasCliente: ['*'] },
    },
    {
      id: 'acessivel',
      nome: 'Acessível',
      quantidade: 1,
      cor: '#D66F78',
      criteriosElegibilidade: {
        categoriasCliente: ['*'],
        requerAcessibilidade: true,
      },
      tiposVeiculoPermitidos: ['compacto', 'sedan', 'suv', 'van'],
    },
  ],
};

function executar() {
  const config = new ConfiguracaoEstacionamento(configuracaoValida);
  assert.equal(config.nome, 'Estacionamento Central');
  assert.equal(config.capacidadeTotal, 6);
  assert.equal(config.categorias.length, 3);
  assert.equal(config.categorias[0].criteriosElegibilidade.requerAcessibilidade, false);
  assert.deepEqual(config.categorias[1].tiposVeiculoPermitidos, ConfiguracaoEstacionamento.TIPOS_VEICULO);
  assert.equal(config.categorias[2].criteriosElegibilidade.requerAcessibilidade, true);
  console.log('✅ Configuração válida é normalizada e mantém categorias/critério de acessibilidade.');

  assert.throws(
    () => new ConfiguracaoEstacionamento({ ...configuracaoValida, capacidadeTotal: 7 }),
    /deve ser igual à capacidade total/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({ ...configuracaoValida, capacidadeTotal: 0 }),
    /inteiro positivo/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({ ...configuracaoValida, nome: '   ' }),
    /texto não vazio/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configuracaoValida,
      categorias: [{ ...configuracaoValida.categorias[0], cor: 'azul' }, ...configuracaoValida.categorias.slice(1)],
    }),
    /formato hexadecimal/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configuracaoValida,
      categorias: [{ ...configuracaoValida.categorias[0], tiposVeiculoPermitidos: ['caminhao'] }, ...configuracaoValida.categorias.slice(1)],
    }),
    /tipo inválido/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configuracaoValida,
      categorias: [configuracaoValida.categorias[0], { ...configuracaoValida.categorias[1], id: 'estudante' }, configuracaoValida.categorias[2]],
    }),
    /id de categoria duplicado/
  );
  assert.throws(
    () => new ConfiguracaoEstacionamento({
      ...configuracaoValida,
      categorias: [configuracaoValida.categorias[0], configuracaoValida.categorias[1], { ...configuracaoValida.categorias[2], criteriosElegibilidade: { categoriasCliente: ['*'], requerAcessibilidade: 'sim' } }],
    }),
    /deve ser booleano/
  );
  console.log('✅ Validação rejeita capacidade inconsistente, dados vazios, cores/tipos inválidos e categorias duplicadas.');

  const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'estacionamento-config-'));
  const caminho = path.join(diretorio, 'config', 'estacionamento.json');
  try {
    assert.equal(ConfiguracaoJson.carregar(caminho), null, 'arquivo ausente representa primeira execução');
    const salva = ConfiguracaoJson.salvar(caminho, config);
    assert.ok(fs.existsSync(caminho), 'salvamento cria diretórios e arquivo');
    const carregada = ConfiguracaoJson.carregar(caminho);
    assert.deepEqual(carregada.toJSON(), salva.toJSON());
    assert.equal(carregada.nome, 'Estacionamento Central');
    console.log('✅ Configuração é persistida e restaurada após reinicialização.');

    fs.writeFileSync(caminho, '{json inválido', 'utf8');
    assert.throws(() => ConfiguracaoJson.carregar(caminho), /não foi possível ler a configuração/);
    console.log('✅ Arquivo JSON inválido gera erro claro.');
  } finally {
    fs.rmSync(diretorio, { recursive: true, force: true });
  }
}

try {
  executar();
} catch (erro) {
  console.error('❌ Teste de configuração falhou:', erro);
  process.exitCode = 1;
}
