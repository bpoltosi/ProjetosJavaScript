const CadastroClientes = require('../src/clientes/CadastroClientes');
const ClientesCsv = require('../src/persistencia/ClientesCsv');
const path = require('path');

const caminho = path.join('/tmp', 'clientes_teste.csv');

// 1) escreve um CSV de exemplo manualmente e carrega
const fs = require('fs');
fs.writeFileSync(caminho, [
  '11111111111,Ana Estudante,50,Estudante,EST1A23',
  '22222222222,Bruno Professor,,Professor,PRF1B23;PRF2C45',
  '33333333000199,Empresa Parceira,120.5,Empresa,EMP1D67;EMP2E89',
].join('\n') + '\n', 'utf-8');

const cadastro1 = new CadastroClientes();
ClientesCsv.carregar(caminho, cadastro1);

console.log('--- Após carregar ---');
console.log('totalClientes:', cadastro1.totalClientes);
for (const c of cadastro1.listarClientes()) {
  console.log(c.constructor.name, c.documento, c.nome, Array.from(c.placas.keys()), c.saldo ?? c.saldoDevedor ?? null);
}
console.log('placasCadastradas:', Array.from(cadastro1.placasCadastradas));
console.log('mapaPlacaParaCliente tem EST1A23?', cadastro1.mapaPlacaParaCliente.has('EST1A23'));

// 2) salva de volta e recarrega para comparar (round-trip)
const caminho2 = path.join('/tmp', 'clientes_teste_salvo.csv');
ClientesCsv.salvar(caminho2, cadastro1);
console.log('\n--- CSV salvo ---');
console.log(fs.readFileSync(caminho2, 'utf-8'));

const cadastro2 = new CadastroClientes();
ClientesCsv.carregar(caminho2, cadastro2);
console.log('--- Após recarregar do CSV salvo ---');
console.log('totalClientes:', cadastro2.totalClientes);
for (const c of cadastro2.listarClientes()) {
  console.log(c.constructor.name, c.documento, c.nome, Array.from(c.placas.keys()), c.saldo ?? c.saldoDevedor ?? null);
}

// 3) teste de arquivo inexistente (primeira execução) não deve lançar erro
const cadastro3 = new CadastroClientes();
ClientesCsv.carregar('/tmp/nao_existe_XYZ.csv', cadastro3);
console.log('\nArquivo inexistente -> totalClientes:', cadastro3.totalClientes);
