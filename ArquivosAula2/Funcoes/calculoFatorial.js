const compose = (...fns) => fns.reduce((f, g) => (...args) => f(g(...args)));
const range = (a, b) => a > b ? [] : [a, ...range(a + 1, b)];
const produto = arr => arr.reduce((p, a) => p * a, 1);
const fatorial = n => compose(produto, range)(1, n);

console.log(fatorial(4));