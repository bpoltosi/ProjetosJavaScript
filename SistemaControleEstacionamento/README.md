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
```

> Nota: `tests/teste_correcao_fase1.js` (normalização de placa via `Veiculo` +
> inadimplência automática da `Empresa`) faz parte de um PR separado
> (correção pós-avaliação da Fase 1) e só existirá neste diretório depois
> que aquele PR for mergeado.
