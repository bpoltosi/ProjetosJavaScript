const { lerLinhas, escreverLinhas } = require('./CsvUtil');
const Estudante = require('../clientes/Estudante');
const Professor = require('../clientes/Professor');
const Empresa = require('../clientes/Empresa');

/*
  Leitura e escrita do arquivo de clientes pré-cadastrados (Estudante, Professor,
  Empresa). ClienteAvulso nunca aparece aqui — não é gerenciado por CadastroClientes.

  Formato de cada linha (decisão 1.1/roadmap Fase 2, reaberta pelo item B.6 do
  plano de correção da Fase 1 para incluir dataVencimentoBoleto):
    documento,nome,campoEspecifico,tipo,placa1;placa2;...,dataVencimentoBoleto
  - campoEspecifico: saldo (Estudante), saldoDevedor (Empresa), vazio (Professor)
  - tipo: "Estudante" | "Professor" | "Empresa"
  - placas: múltiplas placas separadas por ";"; campo pode ser vazio (nenhuma placa)
  - dataVencimentoBoleto: só relevante para Empresa (ISO 8601, vazio se nenhum
    boleto foi emitido); vazio/ausente para Estudante e Professor. Campo
    adicionado ao final da linha para manter retrocompatibilidade — arquivos
    CSV antigos (5 colunas) continuam sendo lidos normalmente, apenas sem
    vencimento de boleto restaurado.

  Os nomes de método usados aqui (cadastrarCliente, adicionarPlaca via registrarPlaca,
  carregarSaldo) são os mesmos já fixados na Fase 1 a partir da Figura 4 do enunciado.
*/

const TIPO_ESTUDANTE = 'Estudante';
const TIPO_PROFESSOR = 'Professor';
const TIPO_EMPRESA = 'Empresa';

/**
  Carrega o arquivo de clientes para dentro do cadastroClientes informado.
  Se o arquivo não existir (primeira execução), não faz nada (CsvUtil.lerLinhas já
  devolve array vazio nesse caso).
 * @param {string} caminho
 * @param {import('../clientes/CadastroClientes')} cadastroClientes
*/

function carregar(caminho, cadastroClientes) {
  const linhas = lerLinhas(caminho);

  for (const linha of linhas) {
    const [documento, nome, campoEspecifico, tipo, placasStr, dataVencimentoStr] = linha;
    const placas = (placasStr ?? '')
      .split(';')
      .map((placa) => placa.trim())
      .filter((placa) => placa.length > 0);

    let cliente;
    switch (tipo) {
      case TIPO_ESTUDANTE: {
        cliente = new Estudante(documento, nome, 0);
        cadastroClientes.cadastrarCliente(cliente);
        const saldo = campoEspecifico === '' || campoEspecifico == null
          ? 0
          : Number(campoEspecifico);
        if (saldo !== 0) {
          cliente.carregarSaldo(saldo);
        }
        break;
      }
      case TIPO_PROFESSOR: {
        cliente = new Professor(documento, nome);
        cadastroClientes.cadastrarCliente(cliente);
        break;
      }
      case TIPO_EMPRESA: {
        cliente = new Empresa(documento, nome);
        cadastroClientes.cadastrarCliente(cliente);
        const debito = campoEspecifico === '' || campoEspecifico == null
          ? 0
          : Number(campoEspecifico);
        if (debito !== 0) {
          cliente.registrarDebito(debito);
        }
        if (dataVencimentoStr != null && dataVencimentoStr !== '') {
          cliente.emitirBoleto(new Date(dataVencimentoStr));
          // Recalcula inadimplência agora (estado derivado, mesmo padrão usado
          // para placaAtualEstacionada do Professor): sem isso, um relatório
          // que leia cliente.inadimplente antes de qualquer chamada a
          // podeAutorizarEntrada() veria um valor desatualizado logo após o load.
          cliente.verificarVencimento(new Date());
        }
        break;
      }
      default:
        throw new Error(
          `tipo de cliente desconhecido no arquivo de clientes: "${tipo}" (documento ${documento})`
        );
    }

    for (const placa of placas) {
      cadastroClientes.registrarPlaca(documento, placa);
    }
  }
}

/**
  Serializa o estado atual do cadastroClientes para o arquivo indicado,
  sobrescrevendo o conteúdo anterior.
 * @param {string} caminho
 * @param {import('../clientes/CadastroClientes')} cadastroClientes
*/

function salvar(caminho, cadastroClientes) {
  const linhas = cadastroClientes.listarClientes().map((cliente) => {
    let tipo;
    let campoEspecifico = '';
    let dataVencimentoStr = '';

    if (cliente instanceof Estudante) {
      tipo = TIPO_ESTUDANTE;
      campoEspecifico = cliente.saldo;
    } else if (cliente instanceof Professor) {
      tipo = TIPO_PROFESSOR;
      campoEspecifico = '';
    } else if (cliente instanceof Empresa) {
      tipo = TIPO_EMPRESA;
      campoEspecifico = cliente.saldoDevedor;
      dataVencimentoStr = cliente.dataVencimentoBoleto
        ? cliente.dataVencimentoBoleto.toISOString()
        : '';
    } else {
      throw new Error(
        `tipo de cliente não suportado pela persistência: ${cliente.constructor.name}`
      );
    }

    const placasStr = Array.from(cliente.placas.keys()).join(';');
    return [cliente.documento, cliente.nome, campoEspecifico, tipo, placasStr, dataVencimentoStr];
  });

  escreverLinhas(caminho, linhas);
}

module.exports = { carregar, salvar, TIPO_ESTUDANTE, TIPO_PROFESSOR, TIPO_EMPRESA };
