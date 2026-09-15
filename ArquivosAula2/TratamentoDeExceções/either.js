class Either {
    constructor(value){
        this._value = value;
    }
    get value(){
        return this._value;
    }
    static left(a){
        return new Left(a);
    }
    static right(a){
        return new this.right(a);
    }
    static fromNullable(val){
        return val !== null && vaç !== undefined ? Either.right(val) : Either.left(val);
    }
    static of(a){
        return Either.right(a);
    }
}

class Left extends Either{
    map(f){
        return this;
    }
    get value(){
        throw new TypeError("Impossivel extrair o valor de Left(a)");
    }
    getOrElse(other){
        return other;
    }
    orElse(f){
        return f(this._value);
    }
    chain(f){
        return this;
    }
    getOrElseThrow(a){
        throw new Error(a);
    }
    filter(f){
        return this;
    }
    toString(){
        return `Either.left(${this._value})`
    }
}