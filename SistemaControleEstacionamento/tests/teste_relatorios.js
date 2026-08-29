const App = require('../src/App');
const Estudante = require('../src/clientes/Estudante');
const Professor = require('../src/clientes/Professor');
const Empresa = require('../src/clientes/Empresa');

function assert(condicao, mensagem) {
  if (!condicao) {
    console.log(`❌ FALHOU: ${mensagem}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${mensagem}`);
  }
}

// Utilitário para forçar datas específicas nos tickets (sem esperar tempo real)
function forcarDatas(ticket, entrada, saida) {
  ticket.dataHoraEntrada = entrada;
  if (saida) ticket.dataHoraSaida = saida;
}

const app = new App();
const estudante = new Estudante('11111111111', 'Ana Estudante', 100);
const professor = new Professor('22222222222', 'Bruno Professor');
const empresa = new Empresa('33333333000199', 'Empresa Parceira');
app.cadastrarCliente(estudante);
app.cadastrarCliente(professor);
app.cadastrarCliente(empresa);
app.registrarPlaca(estudante.documento, 'EST1A23');
app.registrarPlaca(professor.documento, 'PRF1B23');
app.registrarPlaca(empresa.documento, 'EMP1D67');

// --- Cenário: dois usos do estudante em 2026, um uso da empresa, um avulso ---
// IMPORTANTE: processarSaida calcula o custo usando as datas REAIS (Date.now())
// no momento da chamada. Por isso as datas só podem ser forçadas DEPOIS que a
// saída já foi processada (senão o cálculo de custo usa um intervalo de meses
// entre a data forçada de entrada e a data real de saída).
app.autorizarEntrada('EST1A23');
let saida1 = app.processarSaida('EST1A23');
forcarDatas(saida1, new Date(2026, 0, 10, 9, 0), new Date(2026, 0, 10, 11, 0));

app.autorizarEntrada('EST1A23');
let saida2 = app.processarSaida('EST1A23');
forcarDatas(saida2, new Date(2026, 0, 15, 9, 0), new Date(2026, 0, 15, 11, 0));

app.autorizarEntrada('EMP1D67');
let saida3 = app.processarSaida('EMP1D67');
forcarDatas(saida3, new Date(2026, 0, 12, 8, 0), new Date(2026, 0, 12, 18, 0));

app.autorizarEntrada('AVU9Z99');
let saida4 = app.processarSaida('AVU9Z99');
forcarDatas(saida4, new Date(2026, 0, 20, 8, 0), new Date(2026, 0, 20, 10, 0));

// Professor entra e permanece dentro (ticket aberto)
app.autorizarEntrada('PRF1B23');

const relatorios = app.relatoriosGerenciais;

console.log('\n--- 1) valorArrecadadoPorPeriodo (janeiro/2026, todas categorias) ---');
const r1 = relatorios.valorArrecadadoPorPeriodo(new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59));
console.log(r1);
assert(r1.quantidadeTickets === 4, 'deve contar os 4 tickets fechados de janeiro');
assert(r1.valorTotal === 15 + 15 + 80 + 8, 'valorTotal deve somar os 4 valores pagos');

console.log('\n--- 1b) valorArrecadadoPorPeriodo (só Estudante) ---');
const r1b = relatorios.valorArrecadadoPorPeriodo(new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59), 'Estudante');
console.log(r1b);
assert(r1b.valorTotal === 30 && r1b.quantidadeTickets === 2, 'filtro por categoria Estudante deve somar só os 2 tickets do estudante');

console.log('\n--- 2) situacaoCliente (professor, com veículo dentro) ---');
const r2 = relatorios.situacaoCliente(professor.documento);
console.log(r2);
assert(r2.placasEstacionadas.includes('PRF1B23'), 'professor deve aparecer com PRF1B23 estacionada');
assert(r2.impedidoDeEntrar === true, 'professor com veículo dentro deve estar impedido de nova entrada');

console.log('\n--- 3) registrosClienteCadastrado (estudante, janeiro/2026) ---');
const r3 = relatorios.registrosClienteCadastrado(estudante.documento, new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59));
console.log(r3.tickets.map((t) => ({ placa: t.placa, entrada: t.dataHoraEntrada, valorPago: t.valorPago })));
assert(r3.tickets.length === 2, 'estudante deve ter 2 registros em janeiro');

console.log('\n--- 4) registrosClienteNaoCadastrado (avulso) ---');
const r4 = relatorios.registrosClienteNaoCadastrado('AVU9Z99', new Date(2026, 0, 1), new Date(2026, 0, 31, 23, 59, 59));
console.log(r4.tickets.map((t) => ({ placa: t.placa, valorPago: t.valorPago })));
assert(r4.tickets.length === 1, 'avulso deve ter 1 registro em janeiro');

console.log('\n--- 4b) registrosClienteNaoCadastrado deve rejeitar placa cadastrada ---');
try {
  relatorios.registrosClienteNaoCadastrado('EST1A23', new Date(2026, 0, 1), new Date(2026, 0, 31));
  assert(false, 'deveria ter lançado erro para placa cadastrada');
} catch (e) {
  assert(e.message.includes('cadastrado'), 'erro esperado ao usar registrosClienteNaoCadastrado com placa cadastrada');
}

console.log('\n--- 5) clientesImpedidos ---');
// força estudante a saldo negativo criando outro uso caro
estudante.debitar(1000);
const r5 = relatorios.clientesImpedidos();
console.log(r5);
assert(r5.clientesCadastradosBloqueados.some((c) => c.documento === estudante.documento), 'estudante com saldo negativo deve aparecer em impedidos');
assert(r5.clientesCadastradosBloqueados.some((c) => c.documento === professor.documento), 'professor com veículo dentro deve aparecer em impedidos');

console.log('\n--- 6) top10ClientesFrequentesDoAno(2026) ---');
const r6 = relatorios.top10ClientesFrequentesDoAno(2026);
console.log(r6);
assert(r6[0].identificador === estudante.documento && r6[0].quantidadeUsos === 2, 'estudante deve liderar o ranking com 2 usos em 2026');

console.log('\n=== FIM DOS TESTES DE RELATÓRIOS ===');
