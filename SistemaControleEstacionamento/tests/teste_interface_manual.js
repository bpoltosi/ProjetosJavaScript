const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

/*
  Item 9.4 do roadmap-fase2-estacionamento.md: "Teste manual do fluxo completo
  da interface (cadastro → entrada → saída → consulta → salvar → sair)".

  Este teste automatiza esse fluxo de ponta a ponta, invocando main.js como um
  processo real (não a classe App diretamente) e alimentando o menu textual
  como um usuário faria — com um pequeno atraso entre cada linha digitada.

  Por quê o atraso? Alimentar todas as respostas de uma vez via pipe/stdin faz
  com que o readline (em uso não-interativo/piped) possa emitir múltiplos
  eventos 'line' antes do código anexar o próximo listener via
  rl.question(), perdendo respostas silenciosamente — um efeito colateral só
  da automação, que não ocorre com um usuário real digitando no terminal. O
  atraso reproduz o ritmo de uma pessoa digitando e evita esse artefato.

  Usa uma cópia isolada dos 3 CSVs de exemplo (não os de data/, que ficam
  intocados) para não sujar os dados de demonstração do projeto.
*/

const DIR_PROJETO = path.join(__dirname, '..');
const DIR_TEMP = '/tmp/teste_interface_manual';

function prepararDadosIsolados() {
  fs.rmSync(DIR_TEMP, { recursive: true, force: true });
  fs.mkdirSync(DIR_TEMP, { recursive: true });
  for (const arquivo of ['clientes.csv', 'tickets.csv', 'bloqueios.csv']) {
    fs.copyFileSync(
      path.join(DIR_PROJETO, 'data', arquivo),
      path.join(DIR_TEMP, arquivo)
    );
  }
}

/**
  Roda main.js apontando (via variável de ambiente) para os dados isolados,
  alimentando as linhas do roteiro com um pequeno atraso entre cada uma.
 * @param {string[]} linhas
 * @returns {Promise<{ saida: string, codigo: number }>}
*/

function rodarInterface(linhas) {
  return new Promise((resolve) => {
    const child = spawn('node', ['main.js'], {
      cwd: DIR_PROJETO,
      env: { ...process.env, ESTACIONAMENTO_DIR_DADOS: DIR_TEMP },
    });

    let saida = '';
    child.stdout.on('data', (d) => { saida += d.toString(); });
    child.stderr.on('data', (d) => { saida += `[stderr]${d.toString()}`; });

    (async () => {
      for (const linha of linhas) {
        await new Promise((r) => setTimeout(r, 150));
        child.stdin.write(`${linha}\n`);
      }
    })();

    child.on('close', (codigo) => resolve({ saida, codigo }));
  });
}

function assert(condicao, mensagem) {
  if (!condicao) {
    console.log(`❌ FALHOU: ${mensagem}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ ${mensagem}`);
  }
}

async function main() {
  prepararDadosIsolados();

  // Roteiro: cadastra um novo estudante, cadastra uma placa, faz entrada,
  // faz saída, consulta a situação do cliente, consulta clientes impedidos,
  // salva manualmente e sai.
  const roteiro = [
    '1',            // Cadastro de clientes
    '1',            // tipo: Estudante
    '99988877766',  // documento
    'Teste Interface', // nome
    '20',           // saldo inicial
    's',            // cadastrar uma placa? sim
    'TST9Z99',      // placa
    'n',            // cadastrar mais uma placa? não
    '2',            // Entrada de veículo
    'TST9Z99',      // placa
    '3',            // Saída de veículo
    'TST9Z99',      // placa
    'n',            // recusa de pagamento? não
    '4',            // Consultas e relatórios
    '2',            // situação de um cliente cadastrado
    '99988877766',  // documento
    '5',            // clientes impedidos de entrar
    '0',            // voltar ao menu principal
    '5',            // salvar dados agora
    '6',            // sair
  ];

  const { saida, codigo } = await rodarInterface(roteiro);

  console.log(saida);
  console.log('--- fim da saída bruta ---\n');

  assert(codigo === 0, 'processo encerrou com código 0 (sem crash)');
  assert(saida.includes('Cliente "Teste Interface" cadastrado com sucesso'), 'cadastro de cliente funcionou');
  assert(saida.includes('Placa "TST9Z99" cadastrada com sucesso'), 'cadastro de placa funcionou');
  assert(saida.includes('Entrada autorizada para "TST9Z99"'), 'entrada de veículo funcionou');
  assert(saida.includes('Saída processada'), 'saída de veículo funcionou');
  assert(saida.includes("nome: 'Teste Interface'") || saida.includes('nome: \'Teste Interface\''), 'consulta de situação do cliente retornou o nome correto');
  assert(saida.includes('placasAvulsasBloqueadas'), 'relatório de clientes impedidos foi exibido');
  assert(saida.includes('Dados salvos com sucesso'), 'salvamento manual funcionou');
  assert(saida.includes('Até logo!'), 'fluxo de saída do menu funcionou');
  assert(!saida.includes('Erro inesperado na interface'), 'nenhuma exceção não tratada vazou para o usuário');

  // Confirma que o salvamento realmente persistiu o novo cliente/ticket nos
  // CSVs isolados (não só que a mensagem de sucesso apareceu).
  const clientesSalvos = fs.readFileSync(path.join(DIR_TEMP, 'clientes.csv'), 'utf-8');
  assert(clientesSalvos.includes('99988877766') && clientesSalvos.includes('TST9Z99'), 'cliente e placa novos persistidos em clientes.csv');

  const ticketsSalvos = fs.readFileSync(path.join(DIR_TEMP, 'tickets.csv'), 'utf-8');
  assert(ticketsSalvos.includes('TST9Z99'), 'ticket de entrada/saída persistido em tickets.csv');

  // Dados de demonstração reais (data/) não devem ter sido tocados.
  const ticketsReais = fs.readFileSync(path.join(DIR_PROJETO, 'data', 'tickets.csv'), 'utf-8');
  assert(!ticketsReais.includes('TST9Z99'), 'data/tickets.csv de demonstração permanece intocado');

  fs.rmSync(DIR_TEMP, { recursive: true, force: true });

  console.log('\n=== FIM DO TESTE DE INTERFACE (fluxo completo) ===');
}

main();
