/*  Multiplica todos os pares, entre 1 e 10, por 10 e depois soma eles  */

let numeros = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
let somatorio = numeros
  .filter((n) => n % 2 === 0)   // FILTRA os pares
  .map((a) => a * 10)           // MAPEIA e multiplica por 10
  .reduce((a, b) => a + b);     // RESULTA a soma dos resultados
  
console.log(somatorio);