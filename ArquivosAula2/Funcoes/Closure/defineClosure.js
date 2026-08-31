function defineClosure(n){
    let local = n;
    return () => local;
}

const closure1 = defineClosure(1);
const closure2 = defineClosure(2);
console.log(closure1());
console.log(closure2());