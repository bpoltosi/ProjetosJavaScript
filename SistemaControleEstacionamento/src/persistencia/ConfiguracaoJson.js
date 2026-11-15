const fs = require('node:fs');
const path = require('node:path');
const ConfiguracaoEstacionamento = require('../configuracao/ConfiguracaoEstacionamento');

class ConfiguracaoJson {
  /**
   * Carrega a configuração do estacionamento.
   * Retorna null quando o arquivo ainda não existe (primeira execução).
   * @param {string} caminho
   * @returns {ConfiguracaoEstacionamento|null}
   */
  static carregar(caminho) {
    if (typeof caminho !== 'string' || caminho.trim() === '') {
      throw new Error('caminho da configuração deve ser informado');
    }

    if (!fs.existsSync(caminho)) return null;

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch (erro) {
      throw new Error(`não foi possível ler a configuração em "${caminho}": ${erro.message}`);
    }

    try {
      return new ConfiguracaoEstacionamento(dados);
    } catch (erro) {
      throw new Error(`configuração inválida em "${caminho}": ${erro.message}`);
    }
  }

  /**
   * Valida e salva a configuração. A escrita é feita em arquivo temporário
   * no mesmo diretório e depois renomeada para reduzir o risco de corrupção.
   * @param {string} caminho
   * @param {ConfiguracaoEstacionamento|object} configuracao
   * @returns {ConfiguracaoEstacionamento}
   */
  static salvar(caminho, configuracao) {
    if (typeof caminho !== 'string' || caminho.trim() === '') {
      throw new Error('caminho da configuração deve ser informado');
    }

    const validada = new ConfiguracaoEstacionamento(
      configuracao instanceof ConfiguracaoEstacionamento
        ? configuracao.toJSON()
        : configuracao
    );

    const diretorio = path.dirname(caminho);
    fs.mkdirSync(diretorio, { recursive: true });

    const temporario = `${caminho}.${process.pid}.tmp`;
    try {
      fs.writeFileSync(temporario, `${JSON.stringify(validada, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'w',
      });
      fs.renameSync(temporario, caminho);
    } catch (erro) {
      try {
        if (fs.existsSync(temporario)) fs.unlinkSync(temporario);
      } catch (_) {
        // Preserva o erro original; a limpeza é apenas uma tentativa.
      }
      throw new Error(`não foi possível salvar a configuração em "${caminho}": ${erro.message}`);
    }

    return validada;
  }
}

module.exports = ConfiguracaoJson;
