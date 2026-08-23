/*
  Utilitários de data compartilhados entre os tipos de Cliente
  (cálculo de custo por dias de calendário tocados)
*/

/**
    Verifica se duas datas caem no mesmo dia de calendário local.
 * @param {Date} a
 * @param {Date} b
 * @returns {boolean}
*/

function mesmoDiaLocal(a, b) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
    Quantidade de dias de calendário locais abrangidos pelo intervalo [entrada, saida].
    Mesmo dia = 1; cada meia-noite cruzada incrementa 1.
 * @param {Date} entrada
 * @param {Date} saida
 * @returns {number}
*/

function diasCalendarioTocados(entrada, saida) {
  const inicio = new Date(entrada.getFullYear(), entrada.getMonth(), entrada.getDate());
  const fim = new Date(saida.getFullYear(), saida.getMonth(), saida.getDate());
  const msPorDia = 24 * 60 * 60 * 1000;
  return Math.floor((fim - inicio) / msPorDia) + 1;
}

module.exports = { mesmoDiaLocal, diasCalendarioTocados };