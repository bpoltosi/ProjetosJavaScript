const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const Professor = require('../src/clientes/Professor');
const Empresa = require('../src/clientes/Empresa');

function imprimirTicket(titulo, ticket) {
  console.log(`\n${titulo}`);
  console.log({
    placa: ticket.placa,
    entrada: ticket.dataHoraEntrada,
    saida: ticket.dataHoraSaida,
    custoOriginal: ticket.custoOriginal,
    descontoId: ticket.descontoId,
    valorDesconto: ticket.valorDesconto,
    valorDevido: ticket.valorDevido,
    valorPago: ticket.valorPago,
  });
}

function tentar(rotulo, fn) {
  try {
    return fn();
  } catch (erro) {
    console.log(`❌ ${rotulo}: ${erro.message}`);
    return null;
  }
}

const app = new App();
console.log('1) App instanciado.');

const estudante = new Estudante('11111111111', 'Ana Estudante', 0);
const professor = new Professor('22222222222', 'Bruno Professor');
const empresa = new Empresa('33333333000199', 'Empresa Parceira');

app.cadastrarCliente(estudante);
app.cadastrarCliente(professor);
app.cadastrarCliente(empresa);

app.registrarPlaca(estudante.documento, 'EST1A23');
app.registrarPlaca(professor.documento, 'PRF1B23');
app.registrarPlaca(professor.documento, 'PRF2C45');
app.registrarPlaca(empresa.documento, 'EMP1D67');

console.log('2) Cadastrados: 1 estudante, 1 professor (2 placas) e 1 empresa.');
console.log(`   totalClientes = ${app.cadastroClientes.totalClientes}`);

const ticketEstudante = app.autorizarEntrada('EST1A23');
console.log(`3a) Entrada estudante ${ticketEstudante.placa} autorizada.`);

const ticketProfessor = app.autorizarEntrada('PRF1B23');
console.log(`3b) Entrada professor ${ticketProfessor.placa} autorizada.`);

const ticketAvulso = app.autorizarEntrada('AVU0X99');
console.log(`3c) Entrada avulso ${ticketAvulso.placa} autorizada.`);

tentar('Entrada negada', () => app.autorizarEntrada('PRF2C45'));

const saidaEstudante = app.processarSaida('EST1A23');
imprimirTicket('5a) Saída do estudante', saidaEstudante);
console.log(`    saldo do estudante após débito: ${estudante.saldo}`);

const saidaAvulso = app.processarSaida('AVU0X99');
imprimirTicket('5b) Saída do avulso', saidaAvulso);

console.log('\n6) Tentativa de nova entrada do estudante com saldo negativo:');
tentar('Entrada negada', () => app.autorizarEntrada('EST1A23'));

console.log('\n7) Três usos rápidos do mesmo avulso (desconto ClienteFrequente na 3ª saída):');
const placaFrequente = 'FREQ123';
for (let i = 1; i <= 3; i++) {
  app.autorizarEntrada(placaFrequente);
  const ticket = app.processarSaida(placaFrequente);
  imprimirTicket(`   Uso ${i} — ${placaFrequente}`, ticket);
}

console.log('\n8) Resumo');
console.log({
  clientesCadastrados: app.cadastroClientes.totalClientes,
  veiculosDentro: app.registroDeEntradasESaidas.ticketsAbertos.size,
  placasBloqueadas: Array.from(app.registroDeEntradasESaidas.placasBloqueadas),
});
