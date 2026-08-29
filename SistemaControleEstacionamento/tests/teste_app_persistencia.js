const fs = require('fs');
const path = require('path');
const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const Professor = require('../src/clientes/Professor');

const DIR = '/tmp/app_persistencia_teste';
fs.mkdirSync(DIR, { recursive: true });
const caminhos = {
  clientes: path.join(DIR, 'clientes.csv'),
  tickets: path.join(DIR, 'tickets.csv'),
  bloqueios: path.join(DIR, 'bloqueios.csv'),
};

const app1 = new App();
const estudante = new Estudante('11111111111', 'Ana Estudante', 20);
const professor = new Professor('22222222222', 'Bruno Professor');
app1.cadastrarCliente(estudante);
app1.cadastrarCliente(professor);
app1.registrarPlaca(estudante.documento, 'EST1A23');
app1.registrarPlaca(professor.documento, 'PRF1B23');
app1.autorizarEntrada('PRF1B23'); // fica dentro

app1.salvarTudo(caminhos);

const app2 = new App();
app2.carregarTudo(caminhos);

const professor2 = app2.buscarClientePorDocumento('22222222222');
const falhas = [];
if (app2.listarClientes().length !== 2) falhas.push('quantidade de clientes divergente');
if (!app2.veiculoEstaDentro('PRF1B23')) falhas.push('veículo do professor não restaurado como dentro');
if (professor2.placaAtualEstacionada !== 'PRF1B23') falhas.push('estado derivado do professor não restaurado via App.carregarTudo');

if (falhas.length === 0) {
  console.log('✅ App.carregarTudo/salvarTudo funcionam corretamente end-to-end');
} else {
  console.log('❌ FALHAS:', falhas);
  process.exit(1);
}
