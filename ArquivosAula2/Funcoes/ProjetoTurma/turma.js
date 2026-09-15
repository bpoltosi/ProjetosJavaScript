import { validate } from "bycontract";
import { Aluno } from "./aluno.js";
import { pipe, map, mean, filter, prop } from "ramda";

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
    const filterAprovados = filter(a => a.aprovado());
    const getNome = prop("nome");
    const nomesAprovados = pipe(filterAprovados,map(getNome));
    return nomesAprovados(this.#alunos);
  }

  reprovados() {
    const filterReprovados = filter(a => a.aprovado() == false);
    const getNome = prop("nome");
    const nomesReprovados = pipe(filterReprovados,map(getNome));
    return nomesReprovados(this.#alunos);
  }

  resultadoFinal() {
    return this.#alunos.map((a) => ({
      nome: a.nome,
      media: a.media(),
      aprovado: a.aprovado(),
    }));
  }

  mediaNotasFinais(){
    return pipe(map(a => a.media()), mean)(this.#alunos);
  }
}
