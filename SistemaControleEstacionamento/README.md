Sistema de Controle de Estacionamento — Programação Orientada a Objetos - JavaScript - PUCRS2026/3

Projeto prático de desenvolvimento de um sistema de controle de entrada/saída/permanência de um estacionamento, com todas suas regras de negocio e especificações.

## Correção pós-avaliação da Fase 1

Em resposta ao feedback da avaliação da Fase 1 (ver `plano-correcao-fase1.md`), duas correções
foram aplicadas:

- **Classe `Veiculo`** (`src/veiculos/Veiculo.js`): a placa deixou de ser tratada só como
  `String` solta. `Cliente.placas` passou de `Set<string>` para `Map<string, Veiculo>`, com a
  placa normalizada (maiúsculas, sem espaços nas pontas) no construtor de `Veiculo`.
  `CadastroClientes.mapaPlacaParaCliente`/`placasCadastradas` continuam indexados por string
  (chave primitiva), agora sempre na forma normalizada.
- **Inadimplência automática da `Empresa`**: `Empresa` ganhou `dataVencimentoBoleto`,
  `emitirBoleto(dataVencimento)` e `verificarVencimento(dataAtual)`. A checagem é on-demand —
  disparada dentro de `podeAutorizarEntrada()` — e transiciona `inadimplente = true`
  automaticamente quando há saldo devedor pendente e a data de vencimento já passou. Essa data
  não é persistida em `clientes.csv` por enquanto (ver nota no código de `Empresa.js`).

Testes cobrindo os dois cenários estão em `tests/teste_correcao_fase1.js`. Toda a suíte de
testes existente (`tests/*.js`) foi reexecutada e não houve mudança de comportamento além da
correção pretendida.

**Pendência manual (fora do escopo deste código):** o diagrama de classes entregue como
PDF/imagem na Fase 1 ainda precisa ser atualizado para incluir `Veiculo` e sua associação com
`Cliente` (item A.7 do plano de correção).
