const memoize = (f) => {
    const cache = new Map();
    return (arg) => {
        if (cache.get(arg)){
            return cache.get(arg);
        }
        else {
            const resultado = f(arg);
            cache.set(arg, resultado);
            return resultado;
        }
    };
};

function fib(n){
    if (n < 2) return n;
    return fib(n-1) + fib(n-2);
}

fib = memoize(fib);
const testeFib = n => fib(n);
console.log(testeFib(40));
console.log(testeFib(35));