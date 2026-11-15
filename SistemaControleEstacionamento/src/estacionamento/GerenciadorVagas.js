class GerenciadorVagas {
  constructor(configuracao) {
    if (!configuracao || !Array.isArray(configuracao.categorias)) {
      throw new Error('configuração do estacionamento é necessária para criar as vagas');
    }

    this.configuracao = configuracao;
    this.vagas = configuracao.categorias.flatMap((categoria) =>
      Array.from({ length: categoria.quantidade }, (_, indice) => ({
        id: `${categoria.id.toUpperCase()}-${String(indice + 1).padStart(3, '0')}`,
        categoriaId: categoria.id,
        categoriaNome: categoria.nome,
        cor: categoria.cor,
        status: 'livre',
        placa: null,
        tipoVeiculo: null,
      }))
    );
  }

  temVagaDisponivel() {
    return this.vagas.some((vaga) => vaga.status === 'livre');
  }

  quantidadeOcupadas() {
    return this.vagas.filter((vaga) => vaga.status === 'ocupada').length;
  }

  quantidadeLivres() {
    return this.vagas.filter((vaga) => vaga.status === 'livre').length;
  }

  listarVagas(filtros = {}) {
    return this.vagas
      .filter((vaga) => !filtros.categoriaId || vaga.categoriaId === filtros.categoriaId)
      .filter((vaga) => !filtros.status || vaga.status === filtros.status)
      .map((vaga) => ({ ...vaga }));
  }

  buscarPorId(id) {
    const vaga = this.vagas.find((item) => item.id === id);
    return vaga ? { ...vaga } : null;
  }

  buscarPorPlaca(placa) {
    const vaga = this.vagas.find((item) => item.status === 'ocupada' && item.placa === placa);
    return vaga ? { ...vaga } : null;
  }

  _categoriaDoCliente(cliente) {
    return this.configuracao.perfisCliente?.find((perfil) => perfil.id === cliente.categoriaId) ?? null;
  }

  _podeUsarCategoria(vaga, cliente, veiculo) {
    const categoriaVaga = this.configuracao.categorias.find((categoria) => categoria.id === vaga.categoriaId);
    if (!categoriaVaga) return false;

    const criterios = categoriaVaga.criteriosElegibilidade ?? {};
    const categoriasCliente = criterios.categoriasCliente ?? ['*'];
    if (!categoriasCliente.includes('*') && !categoriasCliente.includes(cliente.categoriaId)) return false;

    const perfil = this._categoriaDoCliente(cliente);
    if (perfil && !perfil.categoriasVagaPermitidas.includes('*') &&
        !perfil.categoriasVagaPermitidas.includes(categoriaVaga.id)) return false;

    if (criterios.requerAcessibilidade === true && cliente.possuiCredencialAcessibilidade !== true) return false;

    if (!categoriaVaga.tiposVeiculoPermitidos.includes(veiculo.tipo)) return false;

    const limite = categoriaVaga.dimensoesMaximas;
    if (limite &&
        (veiculo.comprimentoMetros > limite.comprimentoMetros ||
         veiculo.larguraMetros > limite.larguraMetros)) return false;

    return true;
  }

  _ordenarCategoriasPermitidas(cliente) {
    const perfil = this._categoriaDoCliente(cliente);
    if (!perfil || perfil.categoriasVagaPermitidas.includes('*')) {
      return this.configuracao.categorias.map((categoria) => categoria.id);
    }

    const permitidas = perfil.categoriasVagaPermitidas;
    return [
      ...permitidas,
      ...this.configuracao.categorias
        .map((categoria) => categoria.id)
        .filter((id) => !permitidas.includes(id)),
    ];
  }

  encontrarDisponivel(cliente, veiculo) {
    const categoriasOrdenadas = this._ordenarCategoriasPermitidas(cliente);
    for (const categoriaId of categoriasOrdenadas) {
      const vaga = this.vagas.find((item) =>
        item.categoriaId === categoriaId &&
        item.status === 'livre' &&
        this._podeUsarCategoria(item, cliente, veiculo)
      );
      if (vaga) return vaga;
    }
    return null;
  }

  alocar(placa, cliente, veiculo) {
    const vaga = this.encontrarDisponivel(cliente, veiculo);
    if (!vaga) {
      throw new Error('não há vaga livre compatível com a categoria do cliente e o tipo/dimensões do veículo');
    }
    vaga.status = 'ocupada';
    vaga.placa = placa;
    vaga.tipoVeiculo = veiculo.tipo;
    return { ...vaga };
  }

  restaurarOcupacao(vagaId, placa, cliente, veiculo) {
    if (!vagaId) return this.alocar(placa, cliente, veiculo);

    const vaga = this.vagas.find((item) => item.id === vagaId);
    if (!vaga) throw new Error(`vaga persistida não existe na configuração atual: ${vagaId}`);
    if (vaga.status !== 'livre') throw new Error(`vaga ${vagaId} já foi ocupada durante a restauração`);
    if (!this._podeUsarCategoria(vaga, cliente, veiculo)) {
      throw new Error(`vaga persistida ${vagaId} não é compatível com o veículo ${placa}`);
    }

    vaga.status = 'ocupada';
    vaga.placa = placa;
    vaga.tipoVeiculo = veiculo.tipo;
    return { ...vaga };
  }

  liberarPorPlaca(placa) {
    const vaga = this.vagas.find((item) => item.status === 'ocupada' && item.placa === placa);
    if (!vaga) throw new Error(`não existe vaga ocupada associada à placa ${placa}`);
    vaga.status = 'livre';
    vaga.placa = null;
    vaga.tipoVeiculo = null;
    return { ...vaga };
  }

  bloquear(id) {
    const vaga = this.vagas.find((item) => item.id === id);
    if (!vaga) throw new Error(`vaga não encontrada: ${id}`);
    if (vaga.status === 'ocupada') throw new Error('não é possível bloquear uma vaga ocupada');
    vaga.status = 'bloqueada';
    return { ...vaga };
  }

  desbloquear(id) {
    const vaga = this.vagas.find((item) => item.id === id);
    if (!vaga) throw new Error(`vaga não encontrada: ${id}`);
    if (vaga.status !== 'bloqueada') throw new Error('vaga não está bloqueada');
    vaga.status = 'livre';
    return { ...vaga };
  }
}

module.exports = GerenciadorVagas;
