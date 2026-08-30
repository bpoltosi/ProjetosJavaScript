function f(x){
    if ( x === 0) return 1;
    return x * f(x-1)       // Passo Recursivo
}

console.log(f(0));
console.log(f(4));