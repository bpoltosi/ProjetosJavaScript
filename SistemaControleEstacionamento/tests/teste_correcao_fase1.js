const App = require('../src/App');
const Empresa = require('../src/clientes/Empresa');
const Veiculo = require('../src/veiculos/Veiculo');

function assert(condicao, mensagem) {
  if (!condicao) {
    console.log(`❌ FALHOU: ${mensagem}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${mensagem}`);
  }
}

console.log('=== Correção A: Veiculo ===');

const veiculo1 = new Veiculo('  abc1d23  ');
assert(veiculo1.placa === 'ABC1D23', 'Veiculo normaliza placa (trim + maiúsculas)');

try {
  new Veiculo('   ');
  assert(false, 'Veiculo deveria rejeitar placa vazia/só espaços');
} catch (e) {
  assert(e.message.includes('inválida'), 'Veiculo rejeita placa vazia com erro claro');
}

const app = new App();
const Estudante = require('../src/clientes/Estudante');
const estudante = new Estudante('99999999999', 'Carla Estudante', 0);
app.cadastrarCliente(estudante);

// Cadastra placa em minúsculo/com espaço; deve ser normalizada e acessível
// pela forma normalizada tanto em cliente.placas quanto no cadastro global.
app.registrarPlaca(estudante.documento, '  xpt0a01 ');
assert(estudante.placas.has('XPT0A01'), 'placa fica normalizada em cliente.placas (Map)');
assert(app.buscarClientePorPlaca('XPT0A01') === estudante, 'mapaPlacaParaCliente indexa pela forma normalizada');
assert(app.cadastroClientes.placasCadastradas.has('XPT0A01'), 'placasCadastradas indexa pela forma normalizada');

try {
  app.registrarPlaca(estudante.documento, 'xpt0a01'); // mesma placa, outra caixa -> deve falhar (já tem 1 e é duplicata)
  assert(false, 'deveria rejeitar segunda placa do estudante (limite de 1)');
} catch (e) {
  assert(true, 'estudante continua limitado a 1 placa mesmo com variação de caixa');
}

app.removerPlaca(estudante.documento, 'XPT0A01');
assert(!estudante.placas.has('XPT0A01'), 'removerPlaca remove a chave normalizada de cliente.placas');
assert(!app.cadastroClientes.placasCadastradas.has('XPT0A01'), 'removerPlaca também limpa placasCadastradas');

console.log('\n=== Correção B: inadimplência automática da Empresa ===');

const empresa = new Empresa('11222333000144', 'Empresa Teste');
assert(empresa.podeAutorizarEntrada() === true, 'empresa sem débito começa liberada');

empresa.registrarDebito(500);
assert(empresa.podeAutorizarEntrada() === true, 'débito sozinho (sem boleto vencido) não bloqueia ainda');

const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
empresa.emitirBoleto(ontem);
assert(empresa.inadimplente === false, 'emitir boleto não marca inadimplente imediatamente');

const estavaAutorizada = empresa.podeAutorizarEntrada();
assert(estavaAutorizada === false, 'podeAutorizarEntrada() dispara a checagem e bloqueia após vencimento com saldo pendente');
assert(empresa.inadimplente === true, 'verificarVencimento transicionou inadimplente automaticamente (on-demand)');

empresa.quitarBoleto();
assert(empresa.inadimplente === false, 'quitarBoleto libera a empresa');
assert(empresa.saldoDevedor === 0, 'quitarBoleto zera o saldo devedor');
assert(empresa.dataVencimentoBoleto === null, 'quitarBoleto limpa a data de vencimento');
assert(empresa.podeAutorizarEntrada() === true, 'empresa volta a poder autorizar entrada após quitação');

// Boleto emitido com vencimento futuro não deve bloquear ainda
const empresa2 = new Empresa('22333444000155', 'Empresa Em Dia');
empresa2.registrarDebito(200);
const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
empresa2.emitirBoleto(amanha);
assert(empresa2.podeAutorizarEntrada() === true, 'boleto com vencimento futuro não bloqueia a empresa ainda');

console.log('\n=== FIM DOS TESTES DE CORREÇÃO FASE 1 ===');
