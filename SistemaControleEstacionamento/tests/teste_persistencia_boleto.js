const fs = require('fs');
const path = require('path');
const CadastroClientes = require('../src/clientes/CadastroClientes');
const ClientesCsv = require('../src/persistencia/ClientesCsv');
const Empresa = require('../src/clientes/Empresa');

/*
  Item B.6 do plano-correcao-fase1.md: dataVencimentoBoleto da Empresa
  passou a ser persistida em clientes.csv (6ª coluna). Este teste cobre:

  1) Round-trip básico: emitir boleto -> salvar -> recarregar -> data
     restaurada corretamente (mesmo instante).
  2) Boleto já vencido no momento do reload: inadimplência deve ser
     recalculada imediatamente (não esperar a próxima chamada incidental a
     podeAutorizarEntrada em outro fluxo).
  3) Boleto com vencimento futuro no momento do reload: NÃO deve bloquear.
  4) Retrocompatibilidade: uma linha de CSV antiga, sem a 6ª coluna, continua
     sendo lida normalmente (sem vencimento restaurado, sem erro).
*/

function assert(condicao, mensagem) {
  if (!condicao) {
    console.log(`❌ FALHOU: ${mensagem}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${mensagem}`);
  }
}

const DIR = '/tmp/persistencia_boleto_teste';
fs.mkdirSync(DIR, { recursive: true });

// --- Cenário 1 + 2: boleto vencido, saldo devedor pendente ---
const caminho1 = path.join(DIR, 'clientes_vencido.csv');
const cadastro1 = new CadastroClientes();
const empresaVencida = new Empresa('11111111000111', 'Empresa Vencida');
empresaVencida.registrarDebito(300);
const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
empresaVencida.emitirBoleto(ontem);
cadastro1.cadastrarCliente(empresaVencida);

ClientesCsv.salvar(caminho1, cadastro1);
console.log('--- clientes_vencido.csv ---');
console.log(fs.readFileSync(caminho1, 'utf-8'));

const cadastro1Recarregado = new CadastroClientes();
ClientesCsv.carregar(caminho1, cadastro1Recarregado);
const empresaVencidaRecarregada = cadastro1Recarregado.buscarClientePorDocumento('11111111000111');

assert(
  empresaVencidaRecarregada.dataVencimentoBoleto instanceof Date &&
    empresaVencidaRecarregada.dataVencimentoBoleto.getTime() === ontem.getTime(),
  'dataVencimentoBoleto restaurada com o mesmo instante após reload'
);
assert(
  empresaVencidaRecarregada.saldoDevedor === 300,
  'saldoDevedor restaurado corretamente junto com o boleto'
);
assert(
  empresaVencidaRecarregada.inadimplente === true,
  'inadimplência já recalculada logo após o load (sem esperar chamada externa a podeAutorizarEntrada)'
);
assert(
  empresaVencidaRecarregada.podeAutorizarEntrada() === false,
  'empresa com boleto vencido e saldo pendente continua bloqueada após reload'
);

// --- Cenário 3: boleto com vencimento futuro ---
const caminho2 = path.join(DIR, 'clientes_em_dia.csv');
const cadastro2 = new CadastroClientes();
const empresaEmDia = new Empresa('22222222000122', 'Empresa Em Dia');
empresaEmDia.registrarDebito(150);
const amanha = new Date(Date.now() + 24 * 60 * 60 * 1000);
empresaEmDia.emitirBoleto(amanha);
cadastro2.cadastrarCliente(empresaEmDia);

ClientesCsv.salvar(caminho2, cadastro2);
const cadastro2Recarregado = new CadastroClientes();
ClientesCsv.carregar(caminho2, cadastro2Recarregado);
const empresaEmDiaRecarregada = cadastro2Recarregado.buscarClientePorDocumento('22222222000122');

assert(
  empresaEmDiaRecarregada.podeAutorizarEntrada() === true,
  'empresa com boleto de vencimento futuro NÃO fica bloqueada após reload'
);
assert(
  empresaEmDiaRecarregada.inadimplente === false,
  'inadimplente permanece false quando o vencimento ainda não passou'
);

// --- Cenário 4: retrocompatibilidade com CSV antigo (5 colunas, sem boleto) ---
const caminho3 = path.join(DIR, 'clientes_formato_antigo.csv');
fs.writeFileSync(
  caminho3,
  '33333333000133,Empresa Formato Antigo,500,Empresa,ANT1G23\n',
  'utf-8'
);
const cadastro3 = new CadastroClientes();
ClientesCsv.carregar(caminho3, cadastro3);
const empresaAntiga = cadastro3.buscarClientePorDocumento('33333333000133');

assert(empresaAntiga.saldoDevedor === 500, 'CSV de 5 colunas (formato antigo) continua sendo lido sem erro');
assert(empresaAntiga.dataVencimentoBoleto === null, 'sem 6ª coluna, dataVencimentoBoleto permanece null (nenhum boleto emitido)');
assert(empresaAntiga.podeAutorizarEntrada() === true, 'sem boleto emitido, débito sozinho não bloqueia (comportamento já existente preservado)');

console.log('\n=== FIM DOS TESTES DE PERSISTÊNCIA DO BOLETO ===');
