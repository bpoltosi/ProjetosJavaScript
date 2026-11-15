const CLASSES_DOMINIO = Object.freeze(['estudante', 'professor', 'empresa', 'personalizado']);

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

class CategoriaCliente {
  constructor(dados) {
    exigir(dados && typeof dados === 'object' && !Array.isArray(dados), 'categoria de cliente deve ser um objeto');
    exigir(typeof dados.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(dados.id), 'id da categoria de cliente inválido');
    exigir(typeof dados.nome === 'string' && dados.nome.trim().length > 0, 'nome da categoria de cliente deve ser informado');

    const classeDominio = dados.classeDominio ?? 'personalizado';
    exigir(CLASSES_DOMINIO.includes(classeDominio), `classeDominio inválida para a categoria ${dados.id}`);

    const limitePlacas = dados.limitePlacas ?? null;
    exigir(limitePlacas === null || (Number.isSafeInteger(limitePlacas) && limitePlacas > 0),
      `limitePlacas da categoria ${dados.id} deve ser null ou um inteiro positivo`);

    const categoriasVagaPermitidas = dados.categoriasVagaPermitidas ?? ['*'];
    exigir(Array.isArray(categoriasVagaPermitidas) && categoriasVagaPermitidas.length > 0 &&
      categoriasVagaPermitidas.every((id) => typeof id === 'string' && (id === '*' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id))),
      `categoriasVagaPermitidas da categoria ${dados.id} deve conter IDs válidos ou "*"`);
    exigir(new Set(categoriasVagaPermitidas).size === categoriasVagaPermitidas.length,
      `categoriasVagaPermitidas da categoria ${dados.id} contém duplicatas`);

    this.id = dados.id;
    this.nome = dados.nome.trim();
    this.classeDominio = classeDominio;
    this.limitePlacas = limitePlacas;
    this.categoriasVagaPermitidas = [...categoriasVagaPermitidas];
  }

  toJSON() {
    return {
      id: this.id,
      nome: this.nome,
      classeDominio: this.classeDominio,
      limitePlacas: this.limitePlacas,
      categoriasVagaPermitidas: [...this.categoriasVagaPermitidas],
    };
  }
}

module.exports = CategoriaCliente;
