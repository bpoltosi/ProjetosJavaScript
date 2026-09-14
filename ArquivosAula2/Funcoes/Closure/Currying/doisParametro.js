function curry(f){
    return function(a){
        return function(b){
            return f(a,b);
        }
    }
}

function somar(a,b){
    return a+b;
}

function multiplicar(a,b){
    return (a*b);
}

const somarCurry = curry(somar);
const multiplicarCurry = curry(multiplicar);
console.log("Soma: "+somarCurry(10)(5));
console.log("Multiplicação: "+multiplicarCurry(5)(4));