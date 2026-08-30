function somar(array){
    if (array.length === 0) return 0;       // Caso Base
    const [primeiro,...resto] = array;
    return primeiro + somar(resto);         // Passo Recursivo
}

let numeros = [1,2,3,4,5];
let somatorio = somar(numeros);

console.log(somar(numeros));
console.log(somatorio);