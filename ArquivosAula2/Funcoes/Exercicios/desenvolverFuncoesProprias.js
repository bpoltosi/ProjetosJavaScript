function map(f, a) {
  //retorna 'n+1'
  const resultado = [];
  for (let elemento of a) {
    resultado.push(f(elemento));
  }
  return resultado;
}
const numeros = [1, 2, 3, 4, 5, 6];
const resultado = map((n) => n + 1, numeros);
console.log(resultado);

function filter(f, a) {
  //apenas >= 2
  const resultado = [];
  for (let elemento of a) {
    if (f(elemento)) {
      resultado.push(elemento);
    }
  }
  return resultado;
}
const resultado2 = filter((n) => n >= 2, numeros);
console.log(resultado2);

function reduce(f, a, i) {
  //produto de todos elementos do Array
  let acumulador = i;
  for (let elemento of a) {
    acumulador = f(acumulador, elemento);
  }
  return acumulador;
}

const resultado3 = reduce((a, b) => a * b, numeros, 1);
console.log(resultado3);
