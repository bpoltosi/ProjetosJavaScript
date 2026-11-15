const CategoriaCliente = require('../clientes/CategoriaCliente');

const TIPOS_VEICULO = Object.freeze([
  'motocicleta',
  'compacto',
  'hatch',
  'sedan',
  'suv',
  'picape',
  'van',
  'micro-onibus',
]);

const VERSAO_ATUAL = 1;

function exigir(condicao, mensagem) {
  if (!condicao) throw new Error(mensagem);
}

function normalizarTexto(valor, campo) {
  exigir(typeof valor === 'string' && valor.trim().length > 0, `${campo} deve ser um texto não vazio`);
  return valor.trim();
}

function normalizarSlug(valor, campo) {
  const slug = normalizarTexto(valor, campo).toLowerCase();
  exigir(/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug), `${campo} deve usar apenas letras minúsculas, números e hífens`);
  return slug;
}

class ConfiguracaoEstacionamento {
  constructor(dados) {
    const validado = ConfiguracaoEstacionamento.validar(dados);
    this.versao = validado.versao;
    this.nome = validado.nome;
    this.capacidadeTotal = validado.capacidadeTotal;
    this.categorias = validado.categorias;
    this.perfisCliente = validado.perfisCliente;
  }

  /**
   * Valida e normaliza a configuração recebida do formulário ou do arquivo.
   * A soma de vagas distribuídas deve corresponder à capacidade total.
   * @param {object} dados
   * @returns {{ versao: number, nome: string, capacidadeTotal: number, categorias: object[] }}
   */
  static validar(dados) {
    exigir(dados && typeof dados === 'object' && !Array.isArray(dados), 'configuração deve ser um objeto');

    const versao = dados.versao ?? VERSAO_ATUAL;
    exigir(versao === VERSAO_ATUAL, `versão de configuração não suportada: ${versao}`);

    const nome = normalizarTexto(dados.nome, 'nome do estacionamento');
    const capacidadeTotal = dados.capacidadeTotal;
    exigir(Number.isSafeInteger(capacidadeTotal) && capacidadeTotal > 0, 'capacidadeTotal deve ser um inteiro positivo');

    exigir(Array.isArray(dados.categorias) && dados.categorias.length > 0, 'informe ao menos uma categoria de vagas');

    const ids = new Set();
    const nomes = new Set();
    let totalDistribuido = 0;

    const categorias = dados.categorias.map((categoria, indice) => {
      exigir(categoria && typeof categoria === 'object' && !Array.isArray(categoria), `categoria ${indice + 1} inválida`);

      const id = normalizarSlug(categoria.id, `id da categoria ${indice + 1}`);
      const nomeCategoria = normalizarTexto(categoria.nome, `nome da categoria ${indice + 1}`);
      const nomeNormalizado = nomeCategoria.toLocaleLowerCase('pt-BR');

      exigir(!ids.has(id), `id de categoria duplicado: ${id}`);
      exigir(!nomes.has(nomeNormalizado), `nome de categoria duplicado: ${nomeCategoria}`);
      ids.add(id);
      nomes.add(nomeNormalizado);

      exigir(Number.isSafeInteger(categoria.quantidade) && categoria.quantidade > 0, `quantidade da categoria ${id} deve ser um inteiro positivo`);
      totalDistribuido += categoria.quantidade;
      exigir(Number.isSafeInteger(totalDistribuido), 'total de vagas distribuídas excede o limite seguro');

      exigir(typeof categoria.cor === 'string' && /^#[0-9a-fA-F]{6}$/.test(categoria.cor), `cor da categoria ${id} deve estar no formato hexadecimal #RRGGBB`);

      const criterios = categoria.criteriosElegibilidade ?? {};
      exigir(criterios && typeof criterios === 'object' && !Array.isArray(criterios), `critérios de elegibilidade da categoria ${id} inválidos`);
      const categoriasCliente = criterios.categoriasCliente ?? ['*'];
      exigir(
        Array.isArray(categoriasCliente) &&
        categoriasCliente.length > 0 &&
        categoriasCliente.every((item) => typeof item === 'string' && (item === '*' || /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item))),
        `categoriasCliente da categoria ${id} deve conter ao menos uma categoria válida ou "*"`
      );
      exigir(
        criterios.requerAcessibilidade === undefined || typeof criterios.requerAcessibilidade === 'boolean',
        `requerAcessibilidade da categoria ${id} deve ser booleano`
      );

      const dimensoesMaximas = categoria.dimensoesMaximas ?? null;
      exigir(
        dimensoesMaximas === null ||
        (dimensoesMaximas && typeof dimensoesMaximas === 'object' && !Array.isArray(dimensoesMaximas) &&
          Number.isFinite(dimensoesMaximas.comprimentoMetros) &&
          dimensoesMaximas.comprimentoMetros > 0 && dimensoesMaximas.comprimentoMetros <= 30 &&
          Number.isFinite(dimensoesMaximas.larguraMetros) &&
          dimensoesMaximas.larguraMetros > 0 && dimensoesMaximas.larguraMetros <= 5),
        `dimensoesMaximas da categoria ${id} deve conter comprimentoMetros e larguraMetros válidos`
      );

      const tiposVeiculoPermitidos = categoria.tiposVeiculoPermitidos ?? TIPOS_VEICULO;
      exigir(
        Array.isArray(tiposVeiculoPermitidos) &&
        tiposVeiculoPermitidos.length > 0 &&
        tiposVeiculoPermitidos.every((tipo) => TIPOS_VEICULO.includes(tipo)),
        `tiposVeiculoPermitidos da categoria ${id} contém um tipo inválido ou está vazio`
      );
      exigir(
        new Set(tiposVeiculoPermitidos).size === tiposVeiculoPermitidos.length,
        `tiposVeiculoPermitidos da categoria ${id} contém duplicatas`
      );

      return {
        id,
        nome: nomeCategoria,
        quantidade: categoria.quantidade,
        cor: categoria.cor.toUpperCase(),
        criteriosElegibilidade: {
          categoriasCliente: [...categoriasCliente],
          requerAcessibilidade: criterios.requerAcessibilidade ?? false,
        },
        tiposVeiculoPermitidos: [...tiposVeiculoPermitidos],
        dimensoesMaximas: dimensoesMaximas ? { ...dimensoesMaximas } : null,
      };
    });

    exigir(
      totalDistribuido === capacidadeTotal,
      `a soma das vagas por categoria (${totalDistribuido}) deve ser igual à capacidade total (${capacidadeTotal})`
    );

    const perfisCliente = dados.perfisCliente ?? [];
    exigir(Array.isArray(perfisCliente), 'perfisCliente deve ser uma lista');

    const idsPerfis = new Set();
    const nomesPerfis = new Set();
    const perfisNormalizados = perfisCliente.map((perfil) => {
      const perfilJson = new CategoriaCliente(perfil).toJSON();
      const nomePerfil = perfilJson.nome.toLocaleLowerCase('pt-BR');

      exigir(!idsPerfis.has(perfilJson.id), `id de perfil de cliente duplicado: ${perfilJson.id}`);
      exigir(!nomesPerfis.has(nomePerfil), `nome de perfil de cliente duplicado: ${perfilJson.nome}`);
      idsPerfis.add(perfilJson.id);
      nomesPerfis.add(nomePerfil);

      for (const idCategoriaVaga of perfilJson.categoriasVagaPermitidas) {
        exigir(idCategoriaVaga === '*' || ids.has(idCategoriaVaga),
          `categoria de vaga inexistente no perfil ${perfilJson.id}: ${idCategoriaVaga}`);
      }
      return perfilJson;
    });

    return { versao, nome, capacidadeTotal, categorias, perfisCliente: perfisNormalizados };
  }

  /**
   * Retorna um objeto simples pronto para serialização JSON.
   */
  toJSON() {
    return {
      versao: this.versao,
      nome: this.nome,
      capacidadeTotal: this.capacidadeTotal,
      perfisCliente: this.perfisCliente.map((perfil) => ({ ...perfil, categoriasVagaPermitidas: [...perfil.categoriasVagaPermitidas] })),
      categorias: this.categorias.map((categoria) => ({
        ...categoria,
        criteriosElegibilidade: {
          ...categoria.criteriosElegibilidade,
          categoriasCliente: [...categoria.criteriosElegibilidade.categoriasCliente],
        },
        tiposVeiculoPermitidos: [...categoria.tiposVeiculoPermitidos],
        dimensoesMaximas: categoria.dimensoesMaximas ? { ...categoria.dimensoesMaximas } : null,
      })),
    };
  }

  static get TIPOS_VEICULO() {
    return [...TIPOS_VEICULO];
  }
}

module.exports = ConfiguracaoEstacionamento;
