const Cliente = require('./Cliente');
const Veiculo = require('../veiculos/Veiculo');

class ClientePersonalizado extends Cliente {
  constructor(documento, nome, perfil) {
    if (!perfil || typeof perfil.id !== 'string') {
      throw new Error('perfil personalizado válido deve ser informado');
    }
    super(documento, nome, { categoriaId: perfil.id });
    this.limitePlacas = perfil.limitePlacas ?? null;
  }

  adicionarPlaca(placa, caracteristicas) {
    if (this.limitePlacas !== null && this.placas.size >= this.limitePlacas) {
      throw new Error(`cliente da categoria ${this.categoriaId} atingiu o limite de ${this.limitePlacas} placa(s)`);
    }
    const veiculo = new Veiculo(placa, caracteristicas);
    this.placas.set(veiculo.placa, veiculo);
    return veiculo.placa;
  }

  // Nesta versão, perfis personalizados não possuem política de cobrança
  // própria no modelo. O comportamento padrão é gratuito até que a política
  // seja definida explicitamente em um bloco de regras de cobrança.
  calcularCusto() {
    return 0;
  }

  podeAutorizarEntrada() {
    return true;
  }
}

module.exports = ClientePersonalizado;
