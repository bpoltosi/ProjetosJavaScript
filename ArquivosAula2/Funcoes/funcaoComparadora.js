let nomes = ["Bruno","Beatris","Carlos","Douglas","Ana"];

nomes.sort((a,b) => {
    const nomeA = a.toLocaleLowerCase();
    const nomeB = b.toLocaleLowerCase();
    return nomeA.localeCompare(nomeB);
})

console.log(nomes);