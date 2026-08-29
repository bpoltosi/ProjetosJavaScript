/*
escreva uma funcao max(array) que recebe um array de numeros
e retorna o maior elemento encontrado no array.
Assuma que o array nao esta vazio.
Nao utilize funcoes auxiliares de outros objetos disponibilizados pelo JavaScript.
Depois mostre um exeplo de execucao da funcao
*/

function max(array){
    let maiorValor = array[0];
    for(let valor of array){
        if (valor > maiorValor){
            maiorValor = valor;
        }
    }
return maiorValor;
}

const numeros = [1,2,3,4,5,67,82,213,20];
console.log(max(numeros));