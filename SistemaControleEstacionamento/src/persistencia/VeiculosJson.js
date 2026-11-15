const fs = require('node:fs');
const path = require('node:path');
const Veiculo = require('../veiculos/Veiculo');

class VeiculosJson {
  static carregar(caminho, cadastroClientes) {
    if (!caminho || !fs.existsSync(caminho)) return;

    let dados;
    try {
      dados = JSON.parse(fs.readFileSync(caminho, 'utf8'));
    } catch (erro) {
      throw new Error(`não foi possível ler os metadados de veículos em "${caminho}": ${erro.message}`);
    }

    if (!dados || dados.versao !== 1 || !Array.isArray(dados.veiculos)) {
      throw new Error(`arquivo de veículos inválido em "${caminho}"`);
    }

    const placasProcessadas = new Set();
    for (const item of dados.veiculos) {
      const veiculo = new Veiculo(item.placa, item);
      if (placasProcessadas.has(veiculo.placa)) {
        throw new Error(`placa duplicada no arquivo de veículos: ${veiculo.placa}`);
      }
      placasProcessadas.add(veiculo.placa);

      const cliente = cadastroClientes.buscarClientePorPlaca(veiculo.placa);
      if (!cliente || !cliente.placas.has(veiculo.placa)) {
        throw new Error(`veículo ${veiculo.placa} não está associado a um cliente cadastrado`);
      }
      cliente.placas.set(veiculo.placa, veiculo);
    }
  }

  static salvar(caminho, cadastroClientes) {
    if (!caminho) return;

    const veiculos = cadastroClientes.listarClientes()
      .flatMap((cliente) => Array.from(cliente.placas.values()).map((veiculo) => veiculo.toJSON()));
    const dados = { versao: 1, veiculos };

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
      throw new Error(`não foi possível salvar os metadados de veículos em "${caminho}": ${erro.message}`);
    }
  }
}

module.exports = VeiculosJson;
