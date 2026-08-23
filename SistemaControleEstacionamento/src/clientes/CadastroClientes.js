/*
    Cadastro de clientes vinculados (Estudante, Professor, Empresa).
    ClienteAvulso nunca é gerenciado aqui (apenas cadastrads).

    Observação: listarBloqueados() chama podeAutorizarEntrada() sem argumentos.
    Professor usa placaAtualEstacionada (conflito de vaga), não inadimplência;
    pode aparecer na lista enquanto um veículo seu estiver dentro.
 */

class CadastroClientes {
  constructor() {
    /** @type {Map<string, import('./Cliente')>} */
    this.clientesPorDocumento = new Map();
    /** @type {Map<string, import('./Cliente')>} */
    this.mapaPlacaParaCliente = new Map();
    /** @type {Set<string>} */
    this.placasCadastradas = new Set();
  }

  /**
    Quantidade de clientes cadastrados.
   * @returns {number}
   */

  get totalClientes() {
    return this.clientesPorDocumento.size;
  }

  /**
   * @param {import('./Cliente')} cliente
   */

  cadastrarCliente(cliente) {
    if (cliente.documento == null) {
      throw new Error('cliente cadastrado precisa de documento');
    }
    if (this.clientesPorDocumento.has(cliente.documento)) {
      throw new Error('já existe cliente cadastrado com este documento');
    }
    this.clientesPorDocumento.set(cliente.documento, cliente);
  }

  /**
    Valida unicidade global da placa e depois delega o limite ao subtipo.
   * @param {string} documento
   * @param {string} placa
   */

  registrarPlaca(documento, placa) {
    const cliente = this.clientesPorDocumento.get(documento);
    if (!cliente) {
      throw new Error('cliente não encontrado para o documento informado');
    }
    if (this.placasCadastradas.has(placa)) {
      throw new Error('placa já cadastrada para outro cliente');
    }
    cliente.adicionarPlaca(placa);
    this.placasCadastradas.add(placa);
    this.mapaPlacaParaCliente.set(placa, cliente);
  }

  /**
    Remove a placa do cliente e desfaz o registro global (Set + Map).
   * @param {string} documento
   * @param {string} placa
   */

  removerPlaca(documento, placa) {
    const cliente = this.clientesPorDocumento.get(documento);
    if (!cliente) {
      throw new Error('cliente não encontrado para o documento informado');
    }
    if (!cliente.placas.has(placa)) {
      throw new Error('placa não pertence a este cliente');
    }
    cliente.removerPlaca(placa);
    this.placasCadastradas.delete(placa);
    this.mapaPlacaParaCliente.delete(placa);
  }

  /**
   * @param {string} documento
   * @returns {import('./Cliente')|null}
  */

  buscarClientePorDocumento(documento) {
    return this.clientesPorDocumento.get(documento) ?? null;
  }

  /**
      (null) indica placa de cliente avulso.
   * @param {string} placa
   * @returns {import('./Cliente')|null}
   */

  buscarClientePorPlaca(placa) {
    return this.mapaPlacaParaCliente.get(placa) ?? null;
  }

  /**
   * @returns {import('./Cliente')[]}
   */

  listarClientes() {
    return Array.from(this.clientesPorDocumento.values());
  }

  /**
   * @returns {import('./Cliente')[]}
   */

  listarBloqueados() {
    return this.listarClientes().filter((cliente) => !cliente.podeAutorizarEntrada());
  }
}

module.exports = CadastroClientes;