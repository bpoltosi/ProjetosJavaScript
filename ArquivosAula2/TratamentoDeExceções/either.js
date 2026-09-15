class Either {
    constructor(value) {
        this._value = value;
    }
    get value() {
        return this._value;
    }
    static left(a) {
        return new Left(a);
    }
    static right(a) {
        return new Right(a);
    }
    static fromNullable(val) {
        return val !== null && val !== undefined ? Either.right(val) : Either.left(val);
    }
    static of(a) {
        return Either.right(a);
    }
}

class Left extends Either {
    map(f) {
        return this;
    }
    get value() {
        throw new TypeError("Impossível extrair o valor de Left(a)");
    }
    getOrElse(other) {
        return other;
    }
    orElse(f) {
        return f(this._value);
    }
    chain(f) {
        return this;
    }
    getOrElseThrow(a) {
        throw new Error(a);
    }
    filter(f) {
        return this;
    }
    toString() {
        return `Either.Left(${typeof this._value === 'object' ? JSON.stringify(this._value) : this._value})`;
    }
}

class Right extends Either {
    map(f) {
        return Either.of(f(this._value));
    }
    getOrElse(other) {
        return this._value;
    }
    orElse() {
        return this;
    }
    chain(f) {
        return f(this._value);
    }
    getOrElseThrow(f) {
        return this._value;
    }
    filter(f) {
        return Either.fromNullable(f(this._value) ? this._value : null);
    }
    toString() {
        return `Either.Right(${typeof this._value === 'object' ? JSON.stringify(this._value) : this._value})`;
    }
}

// Uso:
const buscarAlgoFake = id => {
    if (id % 2 === 0) {
        return { id, nome: "um nome", preco: 1.99 };
    } else {
        throw new Error("Não encontrado");
    }
};

const buscarAlgoEither = id => {
    try {
        const produto = buscarAlgoFake(id);
        return Either.of(produto);
    } catch (error) {
        return Either.left(`Produto não encontrado com ID: ${id}`);
    }
};

console.log(buscarAlgoEither(1).toString());
console.log(buscarAlgoEither(2).toString());

// Testes
buscarAlgoEither(1).chain(console.log); // Nao executa nada (retorna o próprio Left)
buscarAlgoEither(2).chain(console.log); // Imprime o objeto no console