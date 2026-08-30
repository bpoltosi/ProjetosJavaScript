import { Aluno } from "./aluno.js";
import { Turma } from "./turma.js";

let poo = new Turma(10, "Bernardo Copstein", 20);

let a1 = new Aluno(1025, "Jose Dias");
poo.matricular(a1);
poo.matricular(new Aluno(1026, "Aline Cantier"));
poo.matricular(new Aluno(1027, "Berenice Silva"));

poo.informarNota(1025, 1, 8);
poo.informarNota(1027, 1, 6);
poo.informarNota(1027, 2, 6);
poo.informarNota(1026, 1, 9);
poo.informarNota(1026, 2, 9);
poo.informarNota(1025, 2, 7);

console.log(`\nAprovados: ${poo.aprovados()}`);
console.log(`\nReprovados: ${poo.reprovados()}\n`);
console.log(poo.resultadoFinal());
