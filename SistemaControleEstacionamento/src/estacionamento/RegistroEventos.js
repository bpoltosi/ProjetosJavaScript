const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

const ORIGENS_VALIDAS = new Set(['manual', 'api', 'simulacao', 'sistema']);

function dataValida(valor, campo) {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) throw new Error(`${campo} inválida`);
  return data.toISOString();
}

class RegistroEventos {
  constructor(caminho = null) {
    this.caminho = null;
    this.eventos = [];
    if (caminho) this.carregar(caminho);
  }

  configurarPersistencia(caminho) {
    if (typeof caminho !== 'string' || caminho.trim() === '') {
      throw new Error('caminho do histórico de eventos deve ser informado');
    }
    if (this.caminho === caminho) return;
    this.carregar(caminho);
  }

  carregar(caminho) {
    if (typeof caminho !== 'string' || caminho.trim() === '') {
      throw new Error('caminho do histórico de eventos deve ser informado');
    }

    this.caminho = caminho;
    this.eventos = [];
    if (!fs.existsSync(caminho)) return [];

    const conteudo = fs.readFileSync(caminho, 'utf8');
    const linhas = conteudo.split(/\r?\n/);
    for (let indice = 0; indice < linhas.length; indice += 1) {
      const linha = linhas[indice].trim();
      if (!linha) continue;

      let evento;
      try {
        evento = JSON.parse(linha);
      } catch (erro) {
        throw new Error(`evento inválido na linha ${indice + 1} de "${caminho}": ${erro.message}`);
      }

      if (!evento || typeof evento.id !== 'string' || typeof evento.tipo !== 'string' ||
          typeof evento.timestamp !== 'string' || typeof evento.resultado !== 'string') {
        throw new Error(`estrutura de evento inválida na linha ${indice + 1} de "${caminho}"`);
      }
      dataValida(evento.timestamp, `timestamp do evento na linha ${indice + 1}`);
      this.eventos.push(evento);
    }

    return this.eventos.length;
  }

  _normalizar(evento) {
    if (!evento || typeof evento !== 'object' || Array.isArray(evento)) {
      throw new Error('evento deve ser um objeto');
    }
    if (typeof evento.tipo !== 'string' || evento.tipo.trim() === '') {
      throw new Error('tipo do evento deve ser informado');
    }
    if (typeof evento.resultado !== 'string' || evento.resultado.trim() === '') {
      throw new Error('resultado do evento deve ser informado');
    }

    const origem = evento.origem ?? 'manual';
    if (!ORIGENS_VALIDAS.has(origem)) {
      throw new Error(`origem inválida: ${origem}`);
    }

    return {
      id: evento.id ?? randomUUID(),
      timestamp: dataValida(evento.timestamp ?? new Date(), 'timestamp do evento'),
      tipo: evento.tipo.trim().toUpperCase(),
      placa: evento.placa ? String(evento.placa).trim().toUpperCase() : null,
      tipoVeiculo: evento.tipoVeiculo ?? null,
      corVeiculo: evento.corVeiculo ?? null,
      categoriaCliente: evento.categoriaCliente ?? null,
      vagaId: evento.vagaId ?? null,
      resultado: evento.resultado.trim().toLowerCase(),
      motivo: evento.motivo ?? null,
      origem,
      detalhes: evento.detalhes ?? null,
    };
  }

  registrar(evento) {
    return this.registrarVarios([evento])[0];
  }

  registrarVarios(eventos) {
    if (!Array.isArray(eventos) || eventos.length === 0) {
      throw new Error('informe ao menos um evento para registrar');
    }

    const normalizados = eventos.map((evento) => this._normalizar(evento));
    if (this.caminho) {
      fs.mkdirSync(path.dirname(this.caminho), { recursive: true });
      const conteudo = normalizados.map((evento) => JSON.stringify(evento)).join('\n') + '\n';
      // Uma única operação append mantém os eventos da mesma transação juntos.
      fs.appendFileSync(this.caminho, conteudo, { encoding: 'utf8', flag: 'a' });
    }

    this.eventos.push(...normalizados);
    return normalizados;
  }

  consultar(filtros = {}) {
    const pagina = filtros.pagina ?? 1;
    const limite = filtros.limite ?? 50;
    if (!Number.isSafeInteger(pagina) || pagina < 1) throw new Error('pagina deve ser um inteiro positivo');
    if (!Number.isSafeInteger(limite) || limite < 1 || limite > 200) {
      throw new Error('limite deve ser um inteiro entre 1 e 200');
    }

    const desde = filtros.desde == null ? null : new Date(filtros.desde);
    const ate = filtros.ate == null ? null : new Date(filtros.ate);
    if (desde && Number.isNaN(desde.getTime())) throw new Error('filtro desde contém uma data inválida');
    if (ate && Number.isNaN(ate.getTime())) throw new Error('filtro ate contém uma data inválida');
    if (desde && ate && desde > ate) throw new Error('filtro desde não pode ser posterior a ate');

    const placa = filtros.placa ? String(filtros.placa).trim().toUpperCase() : null;
    const tipo = filtros.tipo ? String(filtros.tipo).trim().toUpperCase() : null;
    const origem = filtros.origem ?? null;

    const filtrados = this.eventos
      .filter((evento) => !placa || evento.placa === placa)
      .filter((evento) => !tipo || evento.tipo === tipo)
      .filter((evento) => !origem || evento.origem === origem)
      .filter((evento) => !desde || new Date(evento.timestamp) >= desde)
      .filter((evento) => !ate || new Date(evento.timestamp) <= ate)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    const inicio = (pagina - 1) * limite;
    return {
      eventos: filtrados.slice(inicio, inicio + limite),
      total: filtrados.length,
      pagina,
      limite,
      totalPaginas: Math.ceil(filtrados.length / limite),
    };
  }

  totalEventos() {
    return this.eventos.length;
  }
}

module.exports = RegistroEventos;
