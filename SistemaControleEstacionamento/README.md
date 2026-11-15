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
7) Terminal operacional (histórico de eventos)
8) Financeiro e regularização de bloqueios
9) Simulação automatizada do estacionamento
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
| `clientes.csv` | `documento,nome,campoEspecifico,tipo,placa1;placa2;...,dataVencimentoBoleto` (campoEspecifico = saldo do Estudante, saldoDevedor da Empresa, ou vazio para Professor; dataVencimentoBoleto só é relevante para Empresa — ISO 8601 ou vazio; coluna adicionada ao final para manter retrocompatibilidade com CSVs sem ela) |
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
node tests/teste_persistencia_boleto.js  # round-trip do vencimento do boleto da Empresa (item B.6)
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
  é persistida em `clientes.csv` como a 6ª coluna (ver tabela de formato acima e
  `tests/teste_persistencia_boleto.js`).

Testes cobrindo os dois cenários estão em `tests/teste_correcao_fase1.js`. Toda a suíte de
testes existente (`tests/*.js`) foi reexecutada e não houve mudança de comportamento além da
correção pretendida.

**Pendência manual (fora do escopo deste código):** o diagrama de classes entregue como
PDF/imagem na Fase 1 ainda precisa ser atualizado para incluir `Veiculo` e sua associação com
`Cliente` (item A.7 do plano de correção).

### Simulação automatizada

No menu textual, abra **9) Simulação automatizada do estacionamento**. O serviço oferece iniciar,
pausar, retomar, alterar a velocidade (1x, 2x ou 5x) e encerrar. Na inicialização, informe o ritmo
de chegada, tamanho da frota e intervalo de permanência; os parâmetros podem ser deixados vazios
para usar os padrões.

A frota usa veículos já cadastrados quando disponíveis e gera novos clientes/veículos para completar
o lote. A criação do cadastro é separada da entrada: o veículo só passa a ocupar uma vaga quando
`App.autorizarEntrada()` autoriza a entrada e o `GerenciadorVagas` aloca uma vaga. As saídas usam
`App.processarSaida()`, portanto cobrança, bloqueios, tickets e eventos seguem as mesmas regras da
operação manual. Ao encerrar a simulação, os veículos que ela colocou no estacionamento recebem
saída e as vagas são liberadas.

A velocidade escala o intervalo entre chegadas e o tempo de permanência: 2x representa metade do
tempo configurado; 5x representa um quinto. Todas as ações do simulador são identificadas com origem
`simulacao` no histórico `data/eventos.jsonl`.

### Servidor web e API HTTP

Para executar a aplicação web local:

```bash
npm install
npm run web
```

Por padrão, o servidor escuta somente em `http://127.0.0.1:3000`. A CLI continua disponível em
`npm start`. É possível configurar o endereço e a porta com `ESTACIONAMENTO_HOST`,
`ESTACIONAMENTO_PORTA` ou `PORT`.

Controles da simulação pela API:

| Método | Rota | Ação |
|---|---|---|
| GET | `/api/simulacao` | Estado, estatísticas e velocidade |
| POST | `/api/simulacao/iniciar` | Inicia com opções JSON |
| POST | `/api/simulacao/pausar` | Pausa chegadas e novos ciclos |
| POST | `/api/simulacao/retomar` | Retoma a execução |
| PUT | `/api/simulacao/velocidade` | Recebe `{ "velocidade": 1 }`, `2` ou `5` |
| POST | `/api/simulacao/encerrar` | Finaliza e retira os veículos do simulador |

Exemplo de início:

```bash
curl -X POST http://127.0.0.1:3000/api/simulacao/iniciar \
  -H "Content-Type: application/json" \
  -d '{"velocidade":2,"intervaloChegadaMs":5000,"quantidadeVeiculos":12,"permanenciaMinMs":8000,"permanenciaMaxMs":30000}'
```

O encerramento do servidor também encerra a simulação e salva o estado operacional.

### Mapa top-down em Canvas 2D

O painel web apresenta o mapa top-down ortográfico no Canvas 2D. Cada posição representa
uma vaga retornada por `GET /api/vagas`; não existem vagas simuladas apenas na camada visual.
Os setores usam suas categorias e cores configuradas. O desenho reflete os estados livre,
ocupado e bloqueado, e consulta `GET /api/veiculos/estacionados` para posicionar os veículos
na vaga atribuída pelo backend.

Os sprites dos veículos são pixel art original e ficam separados do renderizador em
`public/assets/pixel-assets.js`. O arquivo mantém padrões por tipo (motocicleta, compacto,
hatch, sedan, SUV, picape, van e micro-ônibus) e a paleta/tiles do cenário. O Canvas desativa
suavização de imagem para preservar bordas nítidas.

Para estacionamentos com muitas vagas, o mapa apresenta blocos paginados. O filtro por categoria
permite focar um setor; clique numa vaga para selecionar o slot e consultar seu estado, ou num
veículo para abrir detalhes de placa, tipo, cor, cliente, categoria, vaga e horário de entrada.
A seleção não altera o estado de negócio: entradas, saídas e bloqueios continuam sendo
executados exclusivamente pelos endpoints do backend.

Arquivos principais:
- `public/app.js`: sincronização HTTP, paginação, seleção e renderização do mapa.
- `public/assets/pixel-assets.js`: sprites, cores e padrões de pixel art.
- `public/styles.css`: moldura responsiva e tratamento pixelated do Canvas.
