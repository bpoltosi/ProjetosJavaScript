function criarFuncaoComparacao (nomePropriedade){
    return (objeto1, objeto2) => {
        const nome1 = objeto1[nomePropriedade];
        const nome2 = objeto2[nomePropriedade];
        const valor1 = objeto1[nomePropriedade].toLowerCase();
        const valor2 = objeto2[nomePropriedade].toLowerCase();

        if(valor1 < valor2) return `O primeiro nome vem primeiro: ${nome1}`;
        if(valor1 > valor2) return `O segundo nome vem primeiro: ${nome2}`;
    };
}

const compare = criarFuncaoComparacao("nome");
const resultado = compare ({nome: "Bruno"},{nome: "Anita"});

console.log(resultado);