const fs = require('node:fs');
const path = require('node:path');

class EstadoVagasJson {
  static carregar(caminho, gerenciadorVagas) {
    if (!caminho || !gerenciadorVagas || !fs.existsSync(caminho)) return;

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch (erro) {
      throw new Error(`não foi possível ler o estado das vagas em "${caminho}": ${erro.message}`);
    }

    if (!dados || dados.versao !== 1 || !Array.isArray(dados.vagasBloqueadas)) {
      throw new Error(`arquivo de estado das vagas inválido em "${caminho}"`);
    }

    const ids = new Set();
    for (const id of dados.vagasBloqueadas) {
      if (typeof id !== 'string' || id.trim() === '') {
        throw new Error('o arquivo de estado contém um identificador de vaga inválido');
      }
      if (ids.has(id)) throw new Error(`vaga duplicada no estado persistido: ${id}`);
      ids.add(id);
      gerenciadorVagas.bloquear(id);
    }
  }

  static salvar(caminho, gerenciadorVagas) {
    if (!caminho || !gerenciadorVagas) return;

    const dados = {
      versao: 1,
      vagasBloqueadas: gerenciadorVagas.listarVagas({ status: 'bloqueada' }).map((vaga) => vaga.id),
    };
    fs.mkdirSync(path.dirname(caminho), { recursive: true });
    const temporario = `${caminho}.${process.pid}.tmp`;

    try {
      fs.writeFileSync(temporario, `${JSON.stringify(dados, null, 2)}\n`, 'utf8');
      fs.renameSync(temporario, caminho);
    } catch (erro) {
      try {
        if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      } catch (_) {
        // Preserva o erro original.
      }
      throw new Error(`não foi possível salvar o estado das vagas em "${caminho}": ${erro.message}`);
    }
  }
}

module.exports = EstadoVagasJson;
