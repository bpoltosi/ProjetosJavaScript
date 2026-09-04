Sistema de Controle de Estacionamento — Programação Orientada a Objetos - JavaScript - PUCRS2026/3

Projeto prático de desenvolvimento de um sistema de controle de entrada/saída/permanência de um estacionamento, com todas suas regras de negocio e especificações.

## Como rodar (Fase 2)

```
npm install
npm start        # equivalente a: node main.js
```

Ao iniciar, o sistema carrega automaticamente os 3 arquivos CSV de `data/`
(`clientes.csv`, `tickets.csv`, `bloqueios.csv`) e sobe um menu textual
interativo:

```
--- Menu Principal ---
1) Cadastro de clientes
2) Entrada de veículo
3) Saída de veículo
4) Consultas e relatórios
5) Salvar dados agora
6) Sair
```

- **Cadastro de clientes**: escolhe o tipo (Estudante/Professor/Empresa),
  coleta documento/nome/saldo-ou-débito inicial e permite cadastrar uma ou
  mais placas na sequência.
- **Entrada/Saída de veículo**: pede a placa (e, na saída, se houve recusa de
  pagamento — relevante só para cliente avulso) e mostra o resultado ou o
  erro de forma amigável, sem derrubar o processo.
- **Consultas e relatórios**: submenu com os 6 relatórios gerenciais exigidos
  (valor arrecadado por período/categoria, situação de um cliente, registros
  de cliente cadastrado/não cadastrado por período, clientes impedidos de
  entrar, top 10 clientes mais frequentes do ano).
- **Salvar dados agora**: grava o estado atual nos 3 CSVs sem encerrar o
  programa.
- **Sair**: salva automaticamente antes de encerrar. O mesmo salvamento
  automático dispara em `Ctrl+C`/`SIGTERM`.

### Arquivos de dados (`data/`)

| Arquivo | Formato por linha |
|---|---|
| `clientes.csv` | `documento,nome,campoEspecifico,tipo,placa1;placa2;...` (campoEspecifico = saldo do Estudante, saldoDevedor da Empresa, ou vazio para Professor) |
| `tickets.csv` | `placa,dataHoraEntrada,dataHoraSaida,custoOriginal,descontoId,valorDesconto,valorDevido,valorPago` (ticket ainda aberto: só placa e dataHoraEntrada preenchidos) |
| `bloqueios.csv` | uma placa avulsa bloqueada por linha (regenerado por completo a cada salvamento) |

Na primeira execução, se algum desses arquivos não existir, o sistema
simplesmente começa com aquela estrutura vazia (não é tratado como erro).

### Testes

```
node tests/demo-fase1-legacy.js          # regressão do núcleo da Fase 1
node tests/teste_clientes_csv.js         # leitura/escrita de clientes.csv
node tests/teste_persistencia_roundtrip.js  # round-trip completo (clientes+tickets+bloqueios)
node tests/teste_app_persistencia.js     # carregarTudo/salvarTudo via App
node tests/teste_relatorios.js           # os 6 relatórios gerenciais, com valores esperados
node tests/teste_interface_manual.js     # fluxo completo da interface interativa, ponta a ponta
node tests/teste_correcao_fase1.js       # normalização de placa (Veiculo) + inadimplência automática da Empresa
```

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
