function curry(f){
    return function (a){
        return function (b){
            return f(a,b);
        }
    }
}

function somar(a,b){
    return a+b;
}

const somarCurry = curry(somar);
console.log(somarCurry(1)(2)); //soma os elementos (1) e (2) = 3