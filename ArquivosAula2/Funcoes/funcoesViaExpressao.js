const somar = function (a,b){   // funcao anonima
    return a + b;
}

console.log(somar(1,3));

(function(a,b){                 // funcao anonima imediatamente invocada
    console.log(a+b);
})(1,10);