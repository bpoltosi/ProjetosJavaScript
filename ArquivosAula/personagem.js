class Personagem {
  #nome;
  #ataque;
  #defesa;
  #choque;
  #agua;
  #vento;
  #fogo;

  constructor({
    nome = undefined,
    ataque = 10,
    defesa = 10,
    choque = false,
    agua = false,
    vento = false,
    fogo = false,
  }) {
    if (nome == undefined) {
      throw new Error("Nome invalido!");
    }

    this.#nome = nome;
    this.#ataque = ataque;
    this.#defesa = defesa;
    this.#choque = choque;
    this.#agua = agua;
    this.#vento = vento;
    this.#fogo = fogo;
  }

  get nome() {
    return this.#nome;
  }
  get ataque() {
    return this.#ataque;
  }
  get defesa() {
    return this.#defesa;
  }
  get choque() {
    return this.#choque;
  }
  get agua() {
    return this.#agua;
  }
  get vento() {
    return this.#vento;
  }
  get fogo() {
    return this.#fogo;
  }

  get configuracao() {
    return {
      choque: this.#choque,
      agua: this.#agua,
      vento: this.#vento,
      fogo: this.#fogo,
    };
  }
  toString() {
    return `Nome:${this.nome}, Ataque: ${this.#ataque}, Defesa: ${this.defesa}`;
  }
}

let p = new Personagem({ nome: "Inspired", ataque: 100, fogo: true });
console.log(p.toString());
console.log(p.configuracao);

let { fogo, agua } = p.configuracao;
console.log(fogo);
console.log(agua);
