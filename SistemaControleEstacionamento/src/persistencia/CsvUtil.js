const fs = require('fs');

/*
  Utilitário genérico de leitura/escrita de arquivos CSV.
  Sabe fazer parse/escaping de uma linha (estilo RFC 4180 simplificado: aspas
  duplas quando o campo contém vírgula, aspas ou quebra de linha) e ler/escrever
  arquivos inteiros como listas de linhas (arrays de campos).

  Usado por ClientesCsv, TicketsCsv e BloqueiosCsv — nenhuma dessas classes deve
  reimplementar parsing de CSV por conta própria.
*/

/**
  Faz o parse de uma única linha de CSV em uma lista de campos (strings).
  Suporta campos entre aspas duplas contendo vírgulas, aspas escapadas ("")
  e sem suporte a quebras de linha dentro do campo (não é necessário aqui).
 * @param {string} linha
 * @returns {string[]}
*/

function parseLinha(linha) {
  const campos = [];
  let atual = '';
  let dentroDeAspas = false;

  for (let i = 0; i < linha.length; i++) {
    const char = linha[i];

    if (dentroDeAspas) {
      if (char === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i++;
        } else {
          dentroDeAspas = false;
        }
      } else {
        atual += char;
      }
    } else if (char === '"') {
      dentroDeAspas = true;
    } else if (char === ',') {
      campos.push(atual);
      atual = '';
    } else {
      atual += char;
    }
  }
  campos.push(atual);
  return campos;
}

/**
  Decide se um campo precisa ser envolvido em aspas (contém vírgula, aspas ou
  quebra de linha) e faz o escaping necessário.
 * @param {string} campo
 * @returns {string}
*/

function formatarCampo(campo) {
  const valor = campo ?? '';
  const precisaAspas = /[",\n\r]/.test(valor);
  if (!precisaAspas) {
    return valor;
  }
  return `"${valor.replace(/"/g, '""')}"`;
}

/**
  Monta uma linha de CSV a partir de uma lista de campos, aplicando escaping
  campo a campo.
 * @param {Array<string|number>} campos
 * @returns {string}
*/

function formatarLinha(campos) {
  return campos.map((campo) => formatarCampo(String(campo ?? ''))).join(',');
}

/**
  Lê um arquivo CSV inteiro e devolve um array de linhas já parseadas (array de
  campos cada). Ignora linhas totalmente em branco. Se o arquivo não existir,
  devolve um array vazio (decisão 3.6 do roadmap: primeira execução não deve
  lançar erro).
 * @param {string} caminho
 * @returns {string[][]}
*/

function lerLinhas(caminho) {
  if (!fs.existsSync(caminho)) {
    return [];
  }
  const conteudo = fs.readFileSync(caminho, 'utf-8');
  return conteudo
    .split(/\r?\n/)
    .filter((linha) => linha.trim().length > 0)
    .map(parseLinha);
}

/**
  Escreve um array de linhas (array de campos cada) em um arquivo CSV, uma por
  linha, sobrescrevendo o conteúdo anterior.
 * @param {string} caminho
 * @param {Array<Array<string|number>>} linhas
*/

function escreverLinhas(caminho, linhas) {
  const conteudo = linhas.map(formatarLinha).join('\n');
  fs.writeFileSync(caminho, conteudo.length > 0 ? conteudo + '\n' : '', 'utf-8');
}

module.exports = { parseLinha, formatarLinha, lerLinhas, escreverLinhas };