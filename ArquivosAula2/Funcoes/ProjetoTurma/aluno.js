import { validate } from "bycontract";

export class Aluno {
  #matricula;
  #nome;
  #notaP1;
  #notaP2;

  constructor(matricula, nome) {
    validate(arguments, ["Number", "String"]);

    if (matricula < 1000 || matricula > 9999) {
      this.#matricula = NaN;
    } else {
      this.#matricula = matricula;
    }

    if (nome.length === 0) {
      this.#nome = "none";
    } else {
      this.#nome = nome;
    }

    this.#notaP1 = -1.0;
    this.#notaP2 = -1.0;
  }

  get matricula() {
    return this.#matricula;
  }
  get nome() {
    return this.#nome;
  }

  set notaP1(nota) {
    this.#notaP1 = nota;
  }
  set notaP2(nota) {
    this.#notaP2 = nota;
  }

  media() {
    const p1 = this.#notaP1 === -1.0 ? 0 : this.#notaP1;
    const p2 = this.#notaP2 === -1.0 ? 0 : this.#notaP2;
    return (p1 + p2) / 2;
  }

  aprovado() {
    // média >= 7.0 para aprovação
    return this.media() >= 7.0;
  }
}
