const Veiculo = require('../veiculos/Veiculo');

/*
    Cadastro de clientes vinculados (Estudante, Professor, Empresa).
    ClienteAvulso nunca é gerenciado aqui (apenas cadastrads).

    Observação: listarBloqueados() chama podeAutorizarEntrada() sem argumentos.
    Professor usa placaAtualEstacionada (conflito de vaga), não inadimplência;
    pode aparecer na lista enquanto um veículo seu estiver dentro.

    Nota (Correção A do plano de correção Fase 1): cliente.placas passou a ser
    Map<string, Veiculo> (era Set<string>), mas placasCadastradas e
    mapaPlacaParaCliente continuam indexados por string normalizada — Set/Map
    de objetos comparariam por referência, não por valor, então usar Veiculo
    como chave aqui quebraria a checagem de unicidade global.
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
    const chave = Veiculo.normalizar(placa);
    if (this.placasCadastradas.has(chave)) {
      throw new Error('placa já cadastrada para outro cliente');
    }
    // adicionarPlaca devolve a placa já normalizada (mesma chave usada em
    // cliente.placas), garantindo que os índices abaixo fiquem consistentes.
    const placaRegistrada = cliente.adicionarPlaca(placa);
    this.placasCadastradas.add(placaRegistrada);
    this.mapaPlacaParaCliente.set(placaRegistrada, cliente);
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
    const chave = Veiculo.normalizar(placa);
    if (!cliente.placas.has(chave)) {
      throw new Error('placa não pertence a este cliente');
    }
    cliente.removerPlaca(chave);
    this.placasCadastradas.delete(chave);
    this.mapaPlacaParaCliente.delete(chave);
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