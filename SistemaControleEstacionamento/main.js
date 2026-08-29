const path = require('path');
const App = require('./src/App');
const InterfaceUsuario = require('./src/interface/InterfaceUsuario');

/*
    Ponto de entrada da Fase 2.

    Fluxo:
      1) monta os 3 caminhos de arquivo (decisão 1.6 do roadmap: sem default
         embutido nas classes de persistência, quem decide é sempre quem
         orquestra — aqui, o main.js);
      2) carrega clientes, tickets e bloqueios para dentro do App;
      3) sobe a interface textual, que roda até o usuário escolher "Sair";
      4) salva automaticamente ao encerrar (saída normal do menu, Ctrl+C ou
         sinal de término do processo) — o gatilho fica aqui, não dentro de
         App, para manter App sem I/O interativo (regra herdada da Fase 1).
*/

const DIR_DADOS = path.join(__dirname, 'data');
const caminhos = {
  clientes: path.join(DIR_DADOS, 'clientes.csv'),
  tickets: path.join(DIR_DADOS, 'tickets.csv'),
  bloqueios: path.join(DIR_DADOS, 'bloqueios.csv'),
};

const app = new App();

try {
  app.carregarTudo(caminhos);
  console.log(`Dados carregados de ${DIR_DADOS}`);
} catch (erro) {
  console.log(`❌ Erro ao carregar dados: ${erro.message}`);
  console.log('Iniciando com o sistema vazio.');
}

function salvarAoEncerrar() {
  app.salvarTudo(caminhos);
}

// Gatilho de salvamento automático ao encerrar o processo por sinal externo
// (Ctrl+C ou kill). O caminho normal (usuário escolhe "Sair" no menu) já
// chama salvarAoEncerrar por conta própria dentro de InterfaceUsuario.iniciar().
let salvandoPorSinal = false;
function tratarSinalDeEncerramento() {
  if (salvandoPorSinal) return;
  salvandoPorSinal = true;
  console.log('\nEncerrando... salvando dados antes de sair.');
  try {
    salvarAoEncerrar();
    console.log('Dados salvos com sucesso.');
  } finally {
    process.exit(0);
  }
}

process.on('SIGINT', tratarSinalDeEncerramento);
process.on('SIGTERM', tratarSinalDeEncerramento);

const interfaceUsuario = new InterfaceUsuario(app, { salvarAoSair: salvarAoEncerrar });

interfaceUsuario.iniciar().catch((erro) => {
  console.error('Erro inesperado na interface:', erro);
  process.exitCode = 1;
});
