import { validate } from "bycontract";
import { Aluno } from "./aluno.js";

export class Turma {
  #numero;
  #professor;
  #alunos;
  #vagas;

  constructor(nroTurma, nomeProfessor, vagas) {
    validate(arguments, ["Number", "String", "Number"]);

    if (nroTurma <= 0 || nomeProfessor.length === 0 || vagas <= 0) {
      this.#numero = -1;
      this.#professor = "none";
      this.#vagas = 0;
    } else {
      this.#numero = nroTurma;
      this.#professor = nomeProfessor;
      this.#vagas = vagas;
    }
    this.#alunos = [];
  }

  matricular(aluno) {
    if (this.#alunos.length < this.#vagas) {
      this.#alunos.push(aluno);
    } else {
      console.log(`Turma cheia. Não foi possível matricular ${aluno.nome}.`);
    }
  }

  informarNota(matricula, prova, nota) {
    let aluno = this.#alunos.find((a) => a.matricula === matricula);
    if (aluno) {
      if (prova === 1) aluno.notaP1 = nota;
      if (prova === 2) aluno.notaP2 = nota;
    }
  }

  aprovados() {
    return this.#alunos.filter((a) => a.aprovado()).map((a) => a.nome);
  }

  reprovados() {
    return this.#alunos.filter((a) => !a.aprovado()).map((a) => a.nome);
  }

  resultadoFinal() {
    return this.#alunos.map((a) => ({
      nome: a.nome,
      media: a.media(),
      aprovado: a.aprovado(),
    }));
  }
}
