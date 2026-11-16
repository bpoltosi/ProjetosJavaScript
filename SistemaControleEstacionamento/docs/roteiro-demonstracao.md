# Roteiro de demonstração — Poltosi Pixel Park

Duração sugerida: 60–90 segundos. Grave o navegador em 1080p, com zoom de 90–100%.
Use uma instalação de demonstração limpa e dados descartáveis. Não grave documentos/placas de
pessoas reais.

## Preparação

1. Na pasta `SistemaControleEstacionamento/`, execute `npm install`.
2. Para não misturar a demonstração com dados pessoais ou dados do repositório, configure uma
   pasta descartável:

   **PowerShell**
   ```powershell
   $env:ESTACIONAMENTO_DIR_DADOS = "$HOME/poltosi-pixel-park-demo-data"
   $env:ESTACIONAMENTO_CONFIG = "$HOME/poltosi-pixel-park-demo-config/estacionamento.json"
   npm run web
   ```

   **Linux/macOS**
   ```bash
   export ESTACIONAMENTO_DIR_DADOS="$HOME/poltosi-pixel-park-demo-data"
   export ESTACIONAMENTO_CONFIG="$HOME/poltosi-pixel-park-demo-config/estacionamento.json"
   npm run web
   ```

3. Abra `http://127.0.0.1:3000`. Faça uma configuração pequena, por exemplo 24 vagas:
   18 gerais, 4 acessíveis e 2 para outro setor. Confirme que a soma das categorias coincide
   com a capacidade.

## Sequência sugerida para o vídeo

| Tempo | O que mostrar | Narração sugerida |
|---|---|---|
| 0–10 s | Assistente inicial e distribuição de vagas | “O Poltosi Pixel Park começa com a configuração da capacidade e dos setores; a configuração é validada e persistida no backend.” |
| 10–22 s | Painel, indicadores e rede de estradas | “O mapa mostra a avenida, o corredor de entrada, as pistas de cada fileira e o corredor de saída. Cada vaga e veículo reflete o backend.” |
| 22–34 s | Gerar 5 clientes/veículos e abrir detalhes | “O gerador cria cadastros e metadados de veículos, mas não estaciona automaticamente. A entrada é uma operação separada.” |
| 34–48 s | Autorizar entrada e acompanhar a rota | “O veículo passa pela guarita, percorre o corredor de entrada e a pista da fileira antes de manobrar para a vaga.” |
| 48–58 s | Processar saída e acompanhar o circuito | “O carro retorna à pista da fileira, segue pelo corredor da direita e sai pela avenida principal.” |
| 58–72 s | Iniciar simulador em 2× e mostrar eventos `simulacao` | “O simulador usa os mesmos serviços de entrada e saída, então lotação, cobranças e recusas são reais, não animações independentes.” |
| 72–85 s | Pausar/encerrar e abrir terminal | “É possível pausar e encerrar a simulação. O terminal mantém o histórico de eventos com sua origem.” |
| 85–90 s | Encerrar e mostrar reinício/persistência | “Configuração, clientes, tickets, bloqueios e eventos são persistidos; a CLI continua disponível pelo mesmo conjunto de dados.” |

## Capturas de tela para o GitHub

Faça as capturas no navegador em execução e salve os arquivos em `docs/screenshots/`:

- `01-setup.png` — assistente inicial com capacidade e categorias preenchidas.
- `02-dashboard.png` — painel completo, indicadores e mapa top-down.
- `03-map-occupied.png` — sprite de veículo em uma vaga ocupada e painel de detalhes selecionado.
- `04-terminal.png` — terminal com entrada, saída e evento de simulação.
- `05-simulator.png` — simulador executando ou pausado com estatísticas visíveis.

Antes de publicar, revise as imagens para garantir que não mostram documentos, placas, caminhos locais,
tokens ou qualquer dado que não queira expor. Só adicione ao README referências a screenshots depois
de as capturas reais terem sido salvas no repositório.

## Encerramento

1. Encerre o simulador no próprio painel (não deixe veículos da simulação ativos).
2. Encerre o servidor com Ctrl+C; o processo para o simulador e salva o estado.
3. Confirme que os dados foram gravados somente na pasta descartável da demonstração.
4. Execute `npm test` para mostrar o resultado da suíte automatizada.

## Frase final

“Poltosi Pixel Park reúne regras de negócio reais, persistência, CLI, API HTTP, uma planta com circuito viário,
rotas animadas e simulação operacional em uma única aplicação JavaScript.”
