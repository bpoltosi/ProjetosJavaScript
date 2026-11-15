const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const diretorioTestes = __dirname;
const arquivos = fs.readdirSync(diretorioTestes)
  .filter((nome) => /^teste_.*\.js$/.test(nome))
  .sort();

if (arquivos.length === 0) {
  console.error('Nenhum teste foi encontrado em tests/.');
  process.exit(1);
}

let falhas = 0;

for (const arquivo of arquivos) {
  console.log(`\n========== ${arquivo} ==========`);
  const resultado = spawnSync(process.execPath, [path.join(diretorioTestes, arquivo)], {
    cwd: path.resolve(diretorioTestes, '..'),
    stdio: 'inherit',
    timeout: 60_000,
  });

  if (resultado.error) {
    falhas += 1;
    console.error(`❌ Não foi possível executar ${arquivo}: ${resultado.error.message}`);
  } else if (resultado.status !== 0) {
    falhas += 1;
    console.error(`❌ ${arquivo} terminou com código ${resultado.status ?? 'desconhecido'}.`);
  } else {
    console.log(`✅ ${arquivo} concluído.`);
  }
}

console.log(`\nResultado: ${arquivos.length - falhas}/${arquivos.length} testes aprovados.`);
if (falhas > 0) process.exit(1);
