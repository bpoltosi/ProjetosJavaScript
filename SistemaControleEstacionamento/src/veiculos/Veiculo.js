/*
 * Dimensões padrão são referências aproximadas para classificar veículos
 * no simulador. Podem ser sobrescritas ao cadastrar um veículo.
 */
const DIMENSOES_PADRAO = Object.freeze({
  motocicleta: { comprimentoMetros: 2.1, larguraMetros: 0.9 },
  compacto: { comprimentoMetros: 3.8, larguraMetros: 1.7 },
  hatch: { comprimentoMetros: 4.0, larguraMetros: 1.75 },
  sedan: { comprimentoMetros: 4.6, larguraMetros: 1.8 },
  suv: { comprimentoMetros: 4.8, larguraMetros: 1.95 },
  picape: { comprimentoMetros: 5.3, larguraMetros: 2.0 },
  van: { comprimentoMetros: 5.5, larguraMetros: 2.1 },
  'micro-onibus': { comprimentoMetros: 7.5, larguraMetros: 2.4 },
});

const CORES_PADRAO = Object.freeze([
  '#D94B4B', '#4477BB', '#E8E8E8', '#252525',
  '#A7ADB4', '#E0B33F', '#4E9666', '#8A63A8',
]);

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

class Veiculo {
  static normalizar(placa) {
    if (typeof placa !== 'string' || placa.trim().length === 0) {
      throw new Error('placa inválida: deve ser uma string não vazia');
    }
    return placa.trim().toUpperCase();
  }

  constructor(placa, caracteristicas = {}) {
    this.placa = Veiculo.normalizar(placa);
    this.aplicarCaracteristicas(caracteristicas);
  }

  aplicarCaracteristicas(caracteristicas = {}) {
    exigir(caracteristicas && typeof caracteristicas === 'object' && !Array.isArray(caracteristicas),
      'características do veículo inválidas');

    const tipo = caracteristicas.tipo ?? this.tipo ?? 'sedan';
    exigir(Object.prototype.hasOwnProperty.call(DIMENSOES_PADRAO, tipo),
      `tipo de veículo não suportado: ${tipo}`);

    const padrao = DIMENSOES_PADRAO[tipo];
    const comprimentoMetros = caracteristicas.comprimentoMetros ?? this.comprimentoMetros ?? padrao.comprimentoMetros;
    const larguraMetros = caracteristicas.larguraMetros ?? this.larguraMetros ?? padrao.larguraMetros;
    const cor = caracteristicas.cor ?? this.cor ?? '#A7ADB4';

    exigir(Number.isFinite(comprimentoMetros) && comprimentoMetros > 0 && comprimentoMetros <= 30,
      'comprimentoMetros deve estar entre 0 e 30');
    exigir(Number.isFinite(larguraMetros) && larguraMetros > 0 && larguraMetros <= 5,
      'larguraMetros deve estar entre 0 e 5');
    exigir(typeof cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(cor),
      'cor do veículo deve estar no formato hexadecimal #RRGGBB');

    this.tipo = tipo;
    this.cor = cor.toUpperCase();
    this.comprimentoMetros = comprimentoMetros;
    this.larguraMetros = larguraMetros;
  }

  toJSON() {
    return {
      placa: this.placa,
      tipo: this.tipo,
      cor: this.cor,
      comprimentoMetros: this.comprimentoMetros,
      larguraMetros: this.larguraMetros,
    };
  }

  toString() {
    return this.placa;
  }

  static get TIPOS() {
    return Object.keys(DIMENSOES_PADRAO);
  }

  static get CORES_PADRAO() {
    return [...CORES_PADRAO];
  }

  static dimensoesPadrao(tipo) {
    const dimensoes = DIMENSOES_PADRAO[tipo];
    if (!dimensoes) throw new Error(`tipo de veículo não suportado: ${tipo}`);
    return { ...dimensoes };
  }
}

module.exports = Veiculo;
