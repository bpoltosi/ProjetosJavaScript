function f(x,y){
    if ( y === 0) return 1;
    return x * f(x,y-1)       // Passo Recursivo
}

console.log(f(0,1));
console.log(f(1,0));
console.log(f(4,2));