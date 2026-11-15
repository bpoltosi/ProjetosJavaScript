const Estudante = require('../clientes/Estudante');
const Professor = require('../clientes/Professor');
const Empresa = require('../clientes/Empresa');
const ClientePersonalizado = require('../clientes/ClientePersonalizado');
const Veiculo = require('../veiculos/Veiculo');

const NOMES = Object.freeze([
  'Ana', 'Bruno', 'Camila', 'Daniel', 'Eduarda', 'Felipe',
  'Gabriela', 'Henrique', 'Isabela', 'João', 'Larissa',
  'Marcos', 'Natália', 'Otávio', 'Patrícia', 'Rafael',
  'Sofia', 'Thiago', 'Valentina', 'Vinícius',
]);

const SOBRENOMES = Object.freeze([
  'Almeida', 'Barbosa', 'Cardoso', 'Dias', 'Esteves',
  'Ferreira', 'Gomes', 'Lima', 'Martins', 'Oliveira',
  'Pereira', 'Ribeiro', 'Santos', 'Souza', 'Teixeira',
]);

const PERFIS_PADRAO = Object.freeze([
  {
    id: 'estudante',
    nome: 'Estudante',
    classeDominio: 'estudante',
    limitePlacas: 1,
    categoriasVagaPermitidas: ['*'],
  },
  {
    id: 'professor',
    nome: 'Professor',
    classeDominio: 'professor',
    limitePlacas: 2,
    categoriasVagaPermitidas: ['*'],
  },
  {
    id: 'empresa',
    nome: 'Empresa',
    classeDominio: 'empresa',
    limitePlacas: null,
    categoriasVagaPermitidas: ['*'],
  },
]);

class GeradorClientes {
  constructor(app, opcoes = {}) {
    this.app = app;
    this.random = opcoes.random ?? Math.random;
    this.sequenciaDocumento = 1;
    this.sequenciaPlaca = 0;
  }

  _perfisDisponiveis() {
    const perfis = new Map(PERFIS_PADRAO.map((perfil) => [perfil.id, { ...perfil }]));
    for (const perfil of this.app.configuracao?.perfisCliente ?? []) {
      perfis.set(perfil.id, { ...perfil });
    }
    return Array.from(perfis.values());
  }

  _escolherPonderado(itens, pesos = {}, rotulo = 'opção') {
    const ids = new Set(itens.map((item) => typeof item === 'string' ? item : item.id));
    for (const [id, peso] of Object.entries(pesos)) {
      if (!ids.has(id)) throw new Error(`peso informado para ${rotulo} desconhecida: ${id}`);
      if (!Number.isFinite(peso) || peso <= 0) throw new Error(`peso de ${rotulo} ${id} deve ser um número positivo`);
    }

    const total = itens.reduce((soma, item) => {
      const id = typeof item === 'string' ? item : item.id;
      return soma + (pesos[id] ?? 1);
    }, 0);

    let sorteio = this.random() * total;
    for (const item of itens) {
      const id = typeof item === 'string' ? item : item.id;
      sorteio -= pesos[id] ?? 1;
      if (sorteio < 0) return item;
    }
    return itens[itens.length - 1];
  }

  _gerarDocumento(perfil) {
    const empresa = perfil.classeDominio === 'empresa';
    for (let tentativa = 0; tentativa < 10000; tentativa += 1) {
      const sequencia = String(this.sequenciaDocumento++).padStart(empresa ? 12 : 11, '0');
      const documento = empresa ? `99${sequencia.slice(-12)}` : sequencia.slice(-11);
      if (!this.app.buscarClientePorDocumento(documento)) return documento;
    }
    throw new Error('não foi possível gerar um documento único após várias tentativas');
  }

  _gerarPlaca(placasDaOperacao) {
    const letras = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const placaEstaEmUso = (placa) =>
      this.app.cadastroClientes.placasCadastradas.has(placa) ||
      this.app.registroDeEntradasESaidas.ticketsAbertos.has(placa) ||
      this.app.registroDeEntradasESaidas.placasBloqueadas.has(placa) ||
      placasDaOperacao.has(placa);

    for (let tentativa = 0; tentativa < 30000; tentativa += 1) {
      const numero = this.sequenciaPlaca++;
      const centena = Math.floor(numero / 2600) % 10;
      const letra = letras[Math.floor(numero / 100) % 26];
      const sufixo = String(numero % 100).padStart(2, '0');
      const placa = `SIM${centena}${letra}${sufixo}`;
      if (!placaEstaEmUso(placa)) {
        placasDaOperacao.add(placa);
        return placa;
      }
    }
    throw new Error('não foi possível gerar uma placa única após várias tentativas');
  }

  _criarCliente(perfil, documento, nome) {
    let cliente;
    switch (perfil.classeDominio) {
      case 'estudante':
        cliente = new Estudante(documento, nome, 0);
        break;
      case 'professor':
        cliente = new Professor(documento, nome);
        break;
      case 'empresa':
        cliente = new Empresa(documento, nome);
        break;
      case 'personalizado':
        cliente = new ClientePersonalizado(documento, nome, perfil);
        break;
      default:
        throw new Error(`classe de domínio não suportada no perfil ${perfil.id}: ${perfil.classeDominio}`);
    }

    // O ID configurado é a identidade do perfil, mesmo quando ele reaproveita
    // uma das classes de domínio preexistentes.
    cliente.categoriaId = perfil.id;
    return cliente;
  }

  gerar(opcoes = {}) {
    const quantidade = opcoes.quantidade;
    if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 500) {
      throw new Error('quantidade deve ser um inteiro entre 1 e 500');
    }

    const veiculosPorCliente = opcoes.veiculosPorCliente ?? 1;
    if (!Number.isSafeInteger(veiculosPorCliente) || veiculosPorCliente < 1 || veiculosPorCliente > 10) {
      throw new Error('veiculosPorCliente deve ser um inteiro entre 1 e 10');
    }

    const perfis = this._perfisDisponiveis();
    if (perfis.length === 0) throw new Error('não existem perfis de clientes disponíveis');

    let perfisElegiveis = perfis;
    if (opcoes.categoriaId) {
      perfisElegiveis = perfis.filter((perfil) => perfil.id === opcoes.categoriaId);
      if (perfisElegiveis.length === 0) throw new Error(`categoria de cliente não encontrada: ${opcoes.categoriaId}`);
    }

    const tiposVeiculo = opcoes.tipoVeiculo
      ? [opcoes.tipoVeiculo]
      : (opcoes.tiposVeiculo ?? Veiculo.TIPOS);
    if (!Array.isArray(tiposVeiculo) || tiposVeiculo.length === 0 ||
        tiposVeiculo.some((tipo) => !Veiculo.TIPOS.includes(tipo))) {
      throw new Error('tiposVeiculo deve conter tipos suportados e não pode estar vazio');
    }

    const cores = opcoes.coresVeiculo ?? Veiculo.CORES_PADRAO;
    if (!Array.isArray(cores) || cores.length === 0 ||
        cores.some((cor) => typeof cor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(cor))) {
      throw new Error('coresVeiculo deve conter ao menos uma cor hexadecimal #RRGGBB');
    }

    const probabilidadeAcessibilidade = opcoes.probabilidadeAcessibilidade ?? 0;
    if (!Number.isFinite(probabilidadeAcessibilidade) ||
        probabilidadeAcessibilidade < 0 || probabilidadeAcessibilidade > 1) {
      throw new Error('probabilidadeAcessibilidade deve estar entre 0 e 1');
    }
    if (opcoes.possuiCredencialAcessibilidade !== undefined &&
        typeof opcoes.possuiCredencialAcessibilidade !== 'boolean') {
      throw new Error('possuiCredencialAcessibilidade deve ser booleano');
    }

    const pesosCategorias = opcoes.pesosCategorias ?? {};
    const pesosTipos = opcoes.pesosTipos ?? {};
    if (!pesosCategorias || typeof pesosCategorias !== 'object' || Array.isArray(pesosCategorias)) {
      throw new Error('pesosCategorias deve ser um objeto');
    }
    if (!pesosTipos || typeof pesosTipos !== 'object' || Array.isArray(pesosTipos)) {
      throw new Error('pesosTipos deve ser um objeto');
    }

    const origem = opcoes.origem ?? 'manual';
    const placasDaOperacao = new Set();
    const clientesCriados = [];
    const falhas = [];
    const distribuicaoCategorias = {};
    const distribuicaoTipos = {};

    for (let indice = 0; indice < quantidade; indice += 1) {
      let documento = null;
      let cliente = null;
      try {
        const perfil = this._escolherPonderado(perfisElegiveis, pesosCategorias, 'categoria');
        documento = this._gerarDocumento(perfil);
        const nome = `${NOMES[Math.floor(this.random() * NOMES.length)]} ${SOBRENOMES[Math.floor(this.random() * SOBRENOMES.length)]}`;
        cliente = this._criarCliente(perfil, documento, nome);

        const acessibilidade = opcoes.possuiCredencialAcessibilidade ??
          (this.random() < probabilidadeAcessibilidade);
        cliente.definirCredencialAcessibilidade(acessibilidade);
        this.app.cadastrarCliente(cliente);

        const veiculos = [];
        const eventos = [{
          tipo: 'CLIENTE_GERADO',
          resultado: 'criado',
          categoriaCliente: perfil.id,
          origem,
          detalhes: `Cliente ${nome} gerado automaticamente.`,
        }];

        for (let indiceVeiculo = 0; indiceVeiculo < veiculosPorCliente; indiceVeiculo += 1) {
          const tipo = this._escolherPonderado(tiposVeiculo, pesosTipos, 'tipo de veículo');
          const cor = cores[Math.floor(this.random() * cores.length)];
          const placa = this._gerarPlaca(placasDaOperacao);
          const caracteristicas = { tipo, cor };
          this.app.registrarPlaca(documento, placa, caracteristicas);
          const veiculo = cliente.placas.get(placa);
          veiculos.push(veiculo.toJSON());
          eventos.push({
            tipo: 'VEICULO_GERADO',
            resultado: 'criado',
            placa,
            tipoVeiculo: tipo,
            corVeiculo: cor,
            categoriaCliente: perfil.id,
            origem,
            detalhes: `Veículo ${placa} gerado para ${nome}.`,
          });
          distribuicaoTipos[tipo] = (distribuicaoTipos[tipo] ?? 0) + 1;
        }

        // O lote de eventos só é gravado depois de criar o cliente e todos os
        // seus veículos. Falha no log desfaz o cadastro completo deste item.
        try {
          this.app.registroEventos.registrarVarios(eventos);
        } catch (erroRegistro) {
          erroRegistro.eventoRegistroFalhou = true;
          throw erroRegistro;
        }

        clientesCriados.push({
          documento,
          nome,
          categoriaId: perfil.id,
          possuiCredencialAcessibilidade: acessibilidade,
          veiculos,
        });
        distribuicaoCategorias[perfil.id] = (distribuicaoCategorias[perfil.id] ?? 0) + 1;
      } catch (erro) {
        if (cliente && this.app.buscarClientePorDocumento(documento)) {
          this.app.cadastroClientes.removerCliente(documento);
        }
        falhas.push({
          indice: indice + 1,
          categoriaId: cliente?.categoriaId ?? opcoes.categoriaId ?? null,
          motivo: erro.message,
        });
      }
    }

    return {
      solicitados: quantidade,
      criados: clientesCriados.length,
      quantidadeFalhas: falhas.length,
      clientes: clientesCriados,
      falhas,
      distribuicaoCategorias,
      distribuicaoTiposVeiculo: distribuicaoTipos,
      entradasRegistradas: 0,
    };
  }
}

module.exports = GeradorClientes;
