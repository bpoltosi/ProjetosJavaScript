import nReadlines from 'n-readlines';

let arquivo = new nReadlines('palavras.txt');
let buf;
let palavra;

let freq = new Map();

while (buf = arquivo.next()) {
    palavra = buf.toString('utf8').trim(); 

    if (freq.has(palavra)) {
        let contador = freq.get(palavra);
        freq.set(palavra, contador + 1); 
    } else {
        freq.set(palavra, 1);
    }
}

for (let [palavra, contagem] of freq) {
    console.log(`${palavra}:${contagem}`);
}