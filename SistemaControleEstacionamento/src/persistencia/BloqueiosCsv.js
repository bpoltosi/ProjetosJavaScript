const { lerLinhas, escreverLinhas } = require('./CsvUtil');

/*
  Leitura e escrita do arquivo de placas bloqueadas (recusa de pagamento de
  cliente avulso — regra 1.1 do documento complementar).

  Formato: uma placa por linha, arquivo dedicado (decisão 1.4 do roadmap Fase 2).
  Não é deduzido do histórico de tickets — é o registro direto de
  RegistroDeEntradas_E_Saidas.placasBloqueadas.
*/

/**
  Carrega o arquivo de bloqueios, populando registro.placasBloqueadas.
 * @param {string} caminho
 * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registro
*/

function carregar(caminho, registro) {
  const linhas = lerLinhas(caminho);
  for (const [placa] of linhas) {
    if (placa && placa.trim().length > 0) {
      registro.placasBloqueadas.add(placa.trim());
    }
  }
}

/**
  Regenera o arquivo por completo a partir de registro.placasBloqueadas.
  Como a origem é um Set, a ordem de escrita não é significativa.
 * @param {string} caminho
 * @param {import('../estacionamento/RegistroDeEntradas_E_Saidas')} registro
*/

function salvar(caminho, registro) {
  const linhas = Array.from(registro.placasBloqueadas).map((placa) => [placa]);
  escreverLinhas(caminho, linhas);
}

module.exports = { carregar, salvar };
