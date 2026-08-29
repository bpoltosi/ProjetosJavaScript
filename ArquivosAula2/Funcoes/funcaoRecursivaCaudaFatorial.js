function f(x) {
  function faux(x, a) {
    if (x === 0) return a;
    return faux(x - 1, a * x);      // Passo Recursivo
  }
  return faux(x, 1);
}
console.log(f(0));
console.log(f(4));
