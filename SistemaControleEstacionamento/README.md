Sistema de Controle de Estacionamento — Programação Orientada a Objetos - JavaScript - PUCRS2026/3

Projeto prático de desenvolvimento de um sistema de controle de entrada/saída/permanência de um estacionamento, com regras de negócio no backend, CLI e painel web.

## Requisitos e instalação

- Node.js 20 LTS recomendado (a suíte de CI é executada em Node.js 20).
- npm instalado.
- Não é necessário banco de dados externo: a persistência local usa CSV, JSON e JSONL.

Na pasta `SistemaControleEstacionamento/`, instale as dependências uma vez:

```bash
npm install
```

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

### Arquivos de dados e configuração

A CLI e o servidor web usam o mesmo diretório de dados por padrão: `data/`.
O arquivo de configuração fica em `config/estacionamento.json`.

| Caminho | Conteúdo / persistência |
|---|---|
| `config/estacionamento.json` | capacidade, nome, categorias de vagas, critérios de elegibilidade, tipos permitidos e perfis de clientes |
| `data/clientes.csv` | `documento,nome,campoEspecifico,tipo,placas,dataVencimentoBoleto,credencialAcessibilidade`; o campo específico armazena saldo de Estudante, débito de Empresa ou vazio; boleto e credencial são compatíveis com arquivos antigos sem as colunas finais |
| `data/tickets.csv` | tickets abertos e fechados: placa, entrada/saída, valores de cobrança/desconto e ID da vaga; tickets abertos não possuem campos de saída |
| `data/bloqueios.csv` | uma placa avulsa bloqueada por linha |
| `data/veiculos.json` | metadados de veículos (tipo, cor e dimensões), vinculados às placas cadastradas |
| `data/estado-vagas.json` | versão do formato e IDs das vagas bloqueadas; ocupação é reconstruída a partir dos tickets abertos e seus IDs de vaga |
| `data/eventos.jsonl` | histórico append-only: um objeto JSON por linha, com timestamp, tipo, placa, vaga, resultado, motivo e origem |

Na primeira execução, a ausência da configuração direciona o painel web ao assistente inicial.
Arquivos de dados ausentes representam um estado vazio. Os dados só são criados/salvos nos
caminhos configurados; os testes usam diretórios temporários próprios.

### Testes automatizados

Execute toda a suíte isolada com um único comando:

```bash
npm test
```

O runner encontra automaticamente todos os arquivos `tests/teste_*.js`, executa cada um em um processo Node separado, aplica timeout por teste e apresenta o total aprovado/falhado. A suíte cobre:

- configuração e validação de categorias, tipos e dimensões;
- clientes, perfis, veículos, regras financeiras e relatórios;
- persistência CSV/JSON/JSONL e reconstrução de ocupação/bloqueios;
- eventos, API HTTP, gerador, simulador e operações de exceção;
- entrega do painel web, assets pixel art, sintaxe do frontend e mapa Canvas;
- fluxo manual da CLI e cenário completo por HTTP com reinicialização do servidor.

O teste integrado `teste_integracao_completa.js` cria um diretório temporário próprio, executa a jornada completa e o remove no encerramento. Os testes legados que gravam arquivos também usam diretórios temporários exclusivos. Nenhum teste automatizado deve escrever em `data/` ou sobrescrever a configuração/dados de demonstração.

Para executar apenas um teste:

```bash
node tests/teste_integracao_completa.js
node tests/teste_simulador_estacionamento.js
node tests/teste_painel_web.js
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

O painel web do Poltosi Pixel Park apresenta o mapa top-down ortográfico no Canvas 2D. Cada posição representa
uma vaga retornada por `GET /api/vagas`; não existem vagas simuladas apenas na camada visual.
Os setores usam suas categorias e cores configuradas. O desenho reflete os estados livre,
ocupado e bloqueado, e consulta `GET /api/veiculos/estacionados` para posicionar os veículos
na vaga atribuída pelo backend.

Os sprites dos veículos são pixel art original e ficam separados do renderizador em
`public/assets/pixel-assets.js`. O arquivo mantém padrões por tipo (motocicleta, compacto,
hatch, sedan, SUV, picape, van e micro-ônibus) e a paleta/tiles do cenário. O Canvas desativa
suavização de imagem para preservar bordas nítidas.

O Poltosi Pixel Park apresenta todas as vagas em uma única planta panorâmica. O circuito viário tem
avenida principal, guarita/cancela, corredor de entrada, pistas horizontais de acesso a cada fileira e
um corredor de retorno que conduz à saída. A circulação é de mão única: os carros entram pela esquerda,
percorrem a pista da fileira correspondente e só deixam o asfalto na manobra final para estacionar.
Na saída, retornam à pista da fileira, seguem até o corredor da direita e sobem até a avenida principal.

A planta não usa fundos coloridos para livre/ocupada: a posição vazia representa uma vaga livre, o sprite
do veículo representa ocupação e a sinalização vermelha identifica bloqueios. O filtro por categoria
foca um setor; clique numa vaga ou veículo para consultar os detalhes. As animações são acionadas por
eventos reais da API e percorrem os mesmos corredores desenhados no mapa, inclusive nas saídas e nas
tentativas barradas. A guarita do fiscal e o terminal operacional permanecem integrados ao pátio.
A simulação web inicia por padrão com 60 veículos na frota e intervalo de 1,6 segundo entre chegadas;
o tamanho da frota pode ser ajustado no painel.

Arquivos principais:
- `public/app.js`: sincronização HTTP, circuito de estradas, planta completa e rotas animadas.
- `public/assets/pixel-assets.js`: sprites, cores e padrões de pixel art.
- `public/styles.css`: moldura responsiva e tratamento pixelated do Canvas.


## Integração CLI e web

A CLI (`npm start`) e o servidor web (`npm run web`) usam por padrão o mesmo diretório
`data/` e os mesmos nomes de arquivo: `clientes.csv`, `tickets.csv`, `bloqueios.csv`,
`veiculos.json`, `estado-vagas.json` e `eventos.jsonl`. A configuração fica por padrão
em `config/estacionamento.json`.

Para apontar os modos para um local de dados/configuração alternativo, defina as variáveis
antes de iniciar o processo:

```bash
# Linux/macOS
export ESTACIONAMENTO_DIR_DADOS="$HOME/estacionamento-data"
export ESTACIONAMENTO_CONFIG="$HOME/estacionamento-config/estacionamento.json"

# Windows PowerShell
$env:ESTACIONAMENTO_DIR_DADOS = "$HOME/estacionamento-data"
$env:ESTACIONAMENTO_CONFIG = "$HOME/estacionamento-config/estacionamento.json"
```

**Execute apenas uma instância (CLI ou web) por diretório de dados por vez.** Ambos os modos
carregam os dados para a memória e salvam ao encerrar; executar dois processos apontando para
a mesma pasta ao mesmo tempo pode provocar sobrescrita por estado desatualizado. Encerre um
modo antes de iniciar o outro. A CLI e o servidor usam agora a mesma variável de configuração
`ESTACIONAMENTO_CONFIG` e a mesma variável `ESTACIONAMENTO_DIR_DADOS`.

## Demonstração do projeto

O roteiro de captura e vídeo está em [`docs/roteiro-demonstracao.md`](docs/roteiro-demonstracao.md).
Ele descreve a sequência de 60–90 segundos, as telas reais a capturar e a preparação de uma
instalação limpa. Não há screenshots fictícios incluídos no repositório: salve as capturas feitas
no navegador em `docs/screenshots/` depois de executar a aplicação.
