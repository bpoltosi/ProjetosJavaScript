const Veiculo = require('../veiculos/Veiculo');

const VELOCIDADES_VALIDAS = Object.freeze([1, 2, 5]);

class SimuladorEstacionamento {
  constructor(app, opcoes = {}) {
    if (!app) throw new Error('instância de App deve ser informada ao simulador');

    this.app = app;
    this.random = opcoes.random ?? Math.random;
    this.agora = opcoes.agora ?? (() => new Date());
    this.agendador = opcoes.agendador ?? {
      setTimeout: (callback, atraso) => setTimeout(callback, atraso),
      clearTimeout: (identificador) => clearTimeout(identificador),
    };

    this.estado = 'parado';
    this.velocidade = 1;
    this.intervaloChegadaMs = 5000;
    this.permanenciaMinMs = 8000;
    this.permanenciaMaxMs = 30000;
    this.probabilidadeTentativaDuplicada = 0.05;
    this.frota = [];
    this.veiculosAtivos = new Map();
    this.veiculosEmProcessamento = new Set();
    this.agendamento = null;
    this.execucaoAtual = null;
    this.tickEmAndamento = false;
    this.estatisticas = this._novasEstatisticas();
    this.ultimoErro = null;
  }

  _novasEstatisticas() {
    return {
      chegadas: 0,
      entradasAutorizadas: 0,
      entradasNegadas: 0,
      saidas: 0,
      clientesGerados: 0,
      veiculosGerados: 0,
    };
  }

  _validarOpcoes(opcoes = {}) {
    const velocidade = opcoes.velocidade ?? 1;
    if (!VELOCIDADES_VALIDAS.includes(velocidade)) {
      throw new Error('velocidade deve ser 1, 2 ou 5');
    }

    const intervaloChegadaMs = opcoes.intervaloChegadaMs ?? 5000;
    if (!Number.isSafeInteger(intervaloChegadaMs) || intervaloChegadaMs < 100 || intervaloChegadaMs > 3600000) {
      throw new Error('intervaloChegadaMs deve ser um inteiro entre 100 e 3600000');
    }

    const permanenciaMinMs = opcoes.permanenciaMinMs ?? 8000;
    const permanenciaMaxMs = opcoes.permanenciaMaxMs ?? 30000;
    if (!Number.isSafeInteger(permanenciaMinMs) || permanenciaMinMs < 100) {
      throw new Error('permanenciaMinMs deve ser um inteiro igual ou superior a 100');
    }
    if (!Number.isSafeInteger(permanenciaMaxMs) || permanenciaMaxMs < permanenciaMinMs) {
      throw new Error('permanenciaMaxMs deve ser um inteiro maior ou igual a permanenciaMinMs');
    }

    const quantidadeVeiculos = opcoes.quantidadeVeiculos ?? 12;
    if (!Number.isSafeInteger(quantidadeVeiculos) || quantidadeVeiculos < 1 || quantidadeVeiculos > 500) {
      throw new Error('quantidadeVeiculos deve ser um inteiro entre 1 e 500');
    }

    const probabilidadeTentativaDuplicada = opcoes.probabilidadeTentativaDuplicada ?? 0.05;
    if (!Number.isFinite(probabilidadeTentativaDuplicada) ||
        probabilidadeTentativaDuplicada < 0 || probabilidadeTentativaDuplicada > 1) {
      throw new Error('probabilidadeTentativaDuplicada deve estar entre 0 e 1');
    }

    return {
      velocidade,
      intervaloChegadaMs,
      permanenciaMinMs,
      permanenciaMaxMs,
      quantidadeVeiculos,
      probabilidadeTentativaDuplicada,
      categoriaId: opcoes.categoriaId,
      pesosCategorias: opcoes.pesosCategorias ?? {},
      tiposVeiculo: opcoes.tiposVeiculo ?? Veiculo.TIPOS,
      pesosTipos: opcoes.pesosTipos ?? {},
      coresVeiculo: opcoes.coresVeiculo ?? Veiculo.CORES_PADRAO,
      reutilizarVeiculosExistentes: opcoes.reutilizarVeiculosExistentes !== false,
      probabilidadeAcessibilidade: opcoes.probabilidadeAcessibilidade ?? 0,
    };
  }

  _agoraDate() {
    const valor = this.agora();
    const data = valor instanceof Date ? new Date(valor.getTime()) : new Date(valor);
    if (Number.isNaN(data.getTime())) throw new Error('relógio do simulador retornou uma data inválida');
    return data;
  }

  _sortear(minimo, maximo) {
    return Math.floor(this.random() * (maximo - minimo + 1)) + minimo;
  }

  _registrarEvento(tipo, resultado, detalhes, dados = {}) {
    return this.app.registroEventos.registrar({
      tipo,
      resultado,
      detalhes,
      origem: 'simulacao',
      timestamp: this._agoraDate(),
      ...dados,
    });
  }

  _registrarFrotaExistente() {
    const placasAdicionadas = new Set(this.frota.map((veiculo) => veiculo.placa));
    for (const cliente of this.app.listarClientes()) {
      for (const veiculo of cliente.placas.values()) {
        if (placasAdicionadas.has(veiculo.placa)) continue;
        this.frota.push({ placa: veiculo.placa, geradoPeloSimulador: false });
        placasAdicionadas.add(veiculo.placa);
      }
    }
  }

  _gerarFrota(quantidade) {
    const existentes = this.frota.length;
    const faltantes = Math.max(0, quantidade - existentes);
    if (faltantes === 0) return;

    const randomAnterior = this.app.geradorClientes.random;
    this.app.geradorClientes.random = this.random;
    let resultado;
    try {
      resultado = this.app.gerarClientes({
      quantidade: faltantes,
      ...(this.opcoes.categoriaId ? { categoriaId: this.opcoes.categoriaId } : {}),
      ...(this.opcoes.pesosCategorias ? { pesosCategorias: this.opcoes.pesosCategorias } : {}),
      tiposVeiculo: this.opcoes.tiposVeiculo,
      pesosTipos: this.opcoes.pesosTipos,
      coresVeiculo: this.opcoes.coresVeiculo,
      probabilidadeAcessibilidade: this.opcoes.probabilidadeAcessibilidade,
        origem: 'simulacao',
      });
    } finally {
      this.app.geradorClientes.random = randomAnterior;
    }

    for (const cliente of resultado.clientes) {
      this.estatisticas.clientesGerados += 1;
      for (const veiculo of cliente.veiculos) {
        this.frota.push({ placa: veiculo.placa, geradoPeloSimulador: true });
        this.estatisticas.veiculosGerados += 1;
      }
    }

    if (resultado.criados === 0) {
      throw new Error(resultado.falhas[0]?.motivo ?? 'não foi possível preparar a frota da simulação');
    }
  }

  iniciar(opcoes = {}) {
    if (this.estado !== 'parado') {
      throw new Error('simulação já está iniciada; pause, retome ou encerre a execução atual');
    }

    this.opcoes = this._validarOpcoes(opcoes);
    this.velocidade = this.opcoes.velocidade;
    this.intervaloChegadaMs = this.opcoes.intervaloChegadaMs;
    this.permanenciaMinMs = this.opcoes.permanenciaMinMs;
    this.permanenciaMaxMs = this.opcoes.permanenciaMaxMs;
    this.probabilidadeTentativaDuplicada = this.opcoes.probabilidadeTentativaDuplicada;
    this.frota = [];
    this.veiculosAtivos.clear();
    this.veiculosEmProcessamento.clear();
    this.estatisticas = this._novasEstatisticas();
    this.ultimoErro = null;

    if (this.opcoes.reutilizarVeiculosExistentes) this._registrarFrotaExistente();
    this._gerarFrota(this.opcoes.quantidadeVeiculos);

    this.estado = 'executando';
    this._registrarEvento(
      'SIMULACAO_INICIADA',
      'executando',
      `Simulação iniciada a ${this.velocidade}x com ${this.frota.length} veículo(s) na frota.`,
      { detalhes: `Intervalo entre chegadas: ${this.intervaloChegadaMs} ms; permanência: ${this.permanenciaMinMs}–${this.permanenciaMaxMs} ms.` }
    );
    this._agendarProximoCiclo();
    return this.obterEstado();
  }

  pausar() {
    if (this.estado !== 'executando') throw new Error('somente uma simulação em execução pode ser pausada');
    this.estado = 'pausado';
    this._cancelarAgendamento();
    this._registrarEvento('SIMULACAO_PAUSADA', 'pausado', 'Simulação pausada pelo operador.');
    return this.obterEstado();
  }

  retomar() {
    if (this.estado !== 'pausado') throw new Error('somente uma simulação pausada pode ser retomada');
    this.estado = 'executando';
    this._registrarEvento('SIMULACAO_RETOMADA', 'executando', 'Simulação retomada pelo operador.');
    this._agendarProximoCiclo();
    return this.obterEstado();
  }

  definirVelocidade(velocidade) {
    if (this.estado === 'parado') throw new Error('inicie a simulação antes de alterar sua velocidade');
    if (!VELOCIDADES_VALIDAS.includes(velocidade)) {
      throw new Error('velocidade deve ser 1, 2 ou 5');
    }
    this.velocidade = velocidade;
    if (this.opcoes) this.opcoes.velocidade = velocidade;
    this._registrarEvento(
      'SIMULACAO_VELOCIDADE_ALTERADA',
      'configurada',
      `Velocidade da simulação alterada para ${velocidade}x.`
    );
    if (this.estado === 'executando') {
      this._cancelarAgendamento();
      this._agendarProximoCiclo();
    }
    return this.obterEstado();
  }

  async encerrar() {
    if (this.estado === 'parado') return this.obterEstado();

    this.estado = 'parado';
    this._cancelarAgendamento();
    if (this.execucaoAtual) {
      try {
        await this.execucaoAtual;
      } catch (erro) {
        this.ultimoErro = erro.message;
      }
    }

    const placasAtivas = Array.from(this.veiculosAtivos.keys());
    for (const placa of placasAtivas) {
      try {
        this.app.processarSaida(placa, {
          origem: 'simulacao',
          dataHoraSaida: this._agoraDate(),
          timestamp: this._agoraDate(),
        });
        this.veiculosAtivos.delete(placa);
        this.estatisticas.saidas += 1;
      } catch (erro) {
        this.ultimoErro = erro.message;
      }
    }

    this._registrarEvento(
      'SIMULACAO_ENCERRADA',
      'parado',
      `Simulação encerrada. ${this.estatisticas.saidas} saída(s) concluída(s) durante a execução/encerramento.`
    );
    return this.obterEstado();
  }

  _cancelarAgendamento() {
    if (this.agendamento !== null) {
      this.agendador.clearTimeout(this.agendamento);
      this.agendamento = null;
    }
  }

  _agendarProximoCiclo() {
    if (this.estado !== 'executando' || this.agendamento !== null) return;
    const atraso = Math.max(1, Math.round(this.intervaloChegadaMs / this.velocidade));
    this.agendamento = this.agendador.setTimeout(() => {
      this.agendamento = null;
      this.execucaoAtual = this.executarCiclo()
        .catch((erro) => {
          this.ultimoErro = erro.message;
          try {
            this._registrarEvento('SIMULACAO_ERRO', 'erro', erro.message);
          } catch {
            // A falha no log secundário não deve deixar o loop agendado travado.
          }
        })
        .finally(() => {
          this.execucaoAtual = null;
          if (this.estado === 'executando') this._agendarProximoCiclo();
        });
    }, atraso);
  }

  async executarCiclo() {
    if (this.estado !== 'executando') return false;
    if (this.tickEmAndamento) return false;

    this.tickEmAndamento = true;
    try {
      await this._processarSaidasVencidas();
      await this._processarTentativaDuplicada();
      await this._processarChegada();
      return true;
    } finally {
      this.tickEmAndamento = false;
    }
  }

  async _processarSaidasVencidas() {
    const agora = this._agoraDate().getTime();
    for (const [placa, dados] of this.veiculosAtivos.entries()) {
      if (dados.saiEm > agora || this.veiculosEmProcessamento.has(placa)) continue;
      this.veiculosEmProcessamento.add(placa);
      try {
        this.app.processarSaida(placa, {
          origem: 'simulacao',
          dataHoraSaida: new Date(agora),
          timestamp: new Date(agora),
        });
        this.veiculosAtivos.delete(placa);
        this.estatisticas.saidas += 1;
      } catch (erro) {
        this.ultimoErro = erro.message;
        this._registrarEvento('SIMULACAO_SAIDA_NEGADA', 'negado', erro.message, { placa });
        dados.saiEm = agora + Math.max(100, Math.round(this.intervaloChegadaMs / this.velocidade));
      } finally {
        this.veiculosEmProcessamento.delete(placa);
      }
    }
  }

  async _processarTentativaDuplicada() {
    if (this.veiculosAtivos.size === 0 || this.random() >= this.probabilidadeTentativaDuplicada) return;
    const placasAtivas = Array.from(this.veiculosAtivos.keys());
    const placa = placasAtivas[Math.floor(this.random() * placasAtivas.length)];
    try {
      this.app.autorizarEntrada(placa, {
        origem: 'simulacao',
        dataHoraEntrada: this._agoraDate(),
        timestamp: this._agoraDate(),
      });
    } catch {
      this.estatisticas.entradasNegadas += 1;
    }
  }

  async _processarChegada() {
    this.estatisticas.chegadas += 1;

    let candidatosLivres = this.frota.filter((veiculo) =>
      !this.veiculosAtivos.has(veiculo.placa) &&
      !this.veiculosEmProcessamento.has(veiculo.placa) &&
      !this.app.registroDeEntradasESaidas.ticketsAbertos.has(veiculo.placa) &&
      !this.app.registroDeEntradasESaidas.placasBloqueadas.has(veiculo.placa)
    );

    if (candidatosLivres.length === 0) {
      const bloqueados = this.frota.filter((veiculo) =>
        this.app.registroDeEntradasESaidas.placasBloqueadas.has(veiculo.placa)
      );
      const ativos = Array.from(this.veiculosAtivos.keys());
      const placa = bloqueados[0]?.placa ?? ativos[0];
      if (placa) {
        try {
          this.app.autorizarEntrada(placa, {
            origem: 'simulacao',
            dataHoraEntrada: this._agoraDate(),
            timestamp: this._agoraDate(),
          });
        } catch {
          this.estatisticas.entradasNegadas += 1;
        }
      }
      return;
    }

    const escolhido = candidatosLivres[Math.floor(this.random() * candidatosLivres.length)];
    const placa = escolhido.placa;
    const agora = this._agoraDate();
    try {
      this.app.autorizarEntrada(placa, {
        origem: 'simulacao',
        dataHoraEntrada: agora,
        timestamp: agora,
      });
      const permanencia = this._sortear(this.permanenciaMinMs, this.permanenciaMaxMs);
      this.veiculosAtivos.set(placa, {
        saiEm: agora.getTime() + Math.round(permanencia / this.velocidade),
        permanenciaMs: permanencia,
      });
      this.estatisticas.entradasAutorizadas += 1;
    } catch {
      this.estatisticas.entradasNegadas += 1;
    }
  }

  obterEstado() {
    return {
      estado: this.estado,
      velocidade: this.velocidade,
      intervaloChegadaMs: this.intervaloChegadaMs,
      intervaloEfetivoMs: Math.max(1, Math.round(this.intervaloChegadaMs / this.velocidade)),
      veiculosNaFrota: this.frota.length,
      veiculosDaSimulacaoEstacionados: this.veiculosAtivos.size,
      agendamentoAtivo: this.agendamento !== null,
      tickEmAndamento: this.tickEmAndamento,
      estatisticas: { ...this.estatisticas },
      ultimoErro: this.ultimoErro,
    };
  }
}

module.exports = SimuladorEstacionamento;
