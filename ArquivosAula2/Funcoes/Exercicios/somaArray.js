let numeros = [1,2,3,4,5];
let somatorio = numeros.reduce((a,b) => a+b, 0); 
let somatorioDois = numeros.reduce((a,b) => a+b);   // Se o valor '0' nao for indicado para iniciar o acomulador, o primeiro valor do Array sera utilizado como valor inicial
console.log(somatorio);