const redutor = (soma, valorAtual, indice, array) => {
    soma += valorAtual;
    return indice === array.length - 1 ? soma / array.length : soma;
};

const calcularMedia = array => array.reduce(redutor, 0);
console.log(calcularMedia([]));
console.log(calcularMedia([1]));
console.log(calcularMedia([1,2,3,4,5,6,7,8,9,10]));