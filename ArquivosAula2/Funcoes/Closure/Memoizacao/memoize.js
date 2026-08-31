const memoize = (f) => {            // memoizacao para uma funcao 'f' de um unico parametro com valores de tipos primitivos
    const cache = new Map();
    return (arg) => {
        if (cache.get(arg)){        // verifica se ja esta contido
            return cache.get(arg);
        }
        else {
            const resultado = f(arg);
            cache.set(arg, resultado);      // seta o resultado dos argumentos dados
            return resultado;
        }
    };
};

const dobro = x => x+x;
const dobroMem = memoize(dobro);
console.log(dobro(5));
console.log(dobroMem(5));