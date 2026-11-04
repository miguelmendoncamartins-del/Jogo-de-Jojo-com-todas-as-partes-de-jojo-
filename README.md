# Jogo-de-Jojo-com-todas-as-partes-de-jojo-
Jogo para a eletiva sobre Jojo e todos as suas partes

## Eternal Destiny

Protótipo jogável de combate top-down feito com Phaser 3, física Arcade, Vite, CSS e JavaScript. Phaser controla a cena, a escala responsiva, o teclado, os corpos de colisão e o ciclo de atualização; o renderizador 2D em pixel art existente foi preservado como textura da cena. O repositório original só continha este README, então não havia engine ou sistemas anteriores a substituir.

Requisitos: Node.js 20.19+ e npm. Execute `npm install` e `npm run dev`; abra o endereço local apresentado pelo Vite. Para gerar a versão de produção, execute `npm run build`. Execute `npm test` para verificar o catálogo e as regras de progressão.

### Deploy

O workflow `.github/workflows/deploy.yml` executa `actions/configure-pages`, roda `npm test` e publica a pasta `dist` no GitHub Pages a cada push para `main`. **Na primeira configuração, altere manualmente a fonte do Pages:** abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**. Enquanto a fonte estiver como **Deploy from a branch**, o GitHub inicia um segundo deployment `pages-build-deployment`, que compete com este workflow e causa o erro “deployment in progress”. Depois da troca, acompanhe os jobs **build** e **deploy** na aba **Actions**. O Vite configura automaticamente o subcaminho do repositório, mantendo assets e sprites acessíveis. Execuções antigas deste workflow são canceladas para evitar concorrência entre pushes.

### Controles

- `W`, `A`, `S`, `D` ou setas: movimentar
- `J` ou espaço: ataque básico na direção do movimento
- `1` a `4`: ativar os poderes mostrados na interface
- `F`: interagir com a pista quando estiver perto do marcador
- Botão **CONTINUAR**: avançar cenas, exploração, objetivos e consequências
- `E` ou o botão **ASSISTÊNCIA**: chamar aliado durante a fase 2 da batalha secreta
- Botão `♪`: ativar ou silenciar efeitos sonoros

### Progressão

As campanhas de Jonathan, Joseph, Jotaro, Josuke, Giorno, Jolyne, Johnny, Gappy e Jodio são definidas em `campaigns.js`. As fases têm objetivos investigáveis, oponentes, paletas e obstáculos próprios, diálogos de entrada/encontro/vitória, rotas, consequências e recompensas. O progresso percorre `INTRO`, exploração, objetivo, encontro, combate, pós-batalha, mudança ambiental e desbloqueio; objetivos e vitórias fora da fase atual não avançam a história.

Concluir uma campanha libera a seguinte. The JOJOLands termina nos capítulos representados e permanece aberta, sem inventar um final oficial. Completar as nove campanhas libera a história secreta, que apresenta uma revanche por Parte em ordem, com 50% a mais de vida e dano no chefe. Depois das nove revanches, Jotaro, Kakyoin e Jolyne enfrentam DIO Over Heaven e Pucci. A segunda fase aumenta vida e dano dos chefes para três vezes os atributos-base, desperta Star Platinum: Over Heaven e libera os poderes supremos. Kakyoin tem as assistências próprias Emerald Splash e Hierophant Green · Barrier.

Vitórias, inimigos derrotados, objetivos, diálogos vistos, caminhos, recompensas e capítulo atual são registrados no `localStorage`. Reabrir o jogo retoma a etapa salva. Transições e eventos são idempotentes. O botão **REINICIAR PROGRESSO** apaga o progresso e desbloqueios deste navegador.

O Phaser Arcade movimenta protagonista e inimigos com hitboxes reais, apresenta golpes telegrafados por padrões, limita o movimento à arena e testa os ataques contra os corpos físicos. A cena registra os retratos tratados como texturas Phaser e desenha a textura Canvas no ciclo do engine.

### Sprites

O registro `sprite-assets.js` associa protagonistas a `Jojo-Sprite/Protagonista`, chefes finais a `Chefe-Final`, antagonistas a `Boss-Secundário`, aliados a `Aliados-do-Protagonista` e DIO Over Heaven a `Chefe-Secreto`. A busca ignora diferenças entre maiúsculas, acentos, espaços e sufixos comuns; também inclui aliases para nomes como `JotaroAnime3`, `Johnny_anime_png`, `Wii A Zeppiin` e `Wonder Of You + Toru`. Se não encontra correspondência na pasta esperada, mantém o fallback em vez de mostrar outra pessoa.

Os arquivos com extensão `.jpeg` são carregados conforme a assinatura real (JPEG, PNG ou WebP). Retratos com fundo claro têm apenas os pixels claros conectados às bordas removidos durante a preparação; os arquivos originais não são alterados. A preparação reduz cada imagem a uma grade pequena e amplia com vizinho mais próximo, criando o acabamento pixelado. O personagem ganha quadros de idle/ataque e efeitos de movimento na arena. Nas Partes 3–9, um Stand pixelado animado acompanha o protagonista.

Diálogos de entrada, encontro e vitória avançam automaticamente após cinco segundos; o botão permite avançar antes. O botão de áudio ativa efeitos sintetizados e uma trilha de batalha original gerada localmente pelo Web Audio. Não há gravações da trilha sonora oficial no repositório.

### Limites do protótipo

Esta é uma primeira versão jogável das campanhas: as fases são missões resumidas com diálogos escritos, não adaptações completas cena a cena. As animações de retrato e Stand são geradas no jogo a partir das imagens de referência, não são spritesheets originais. Não há áudio oficial de JoJo, cooperativo local ou mapas completos. Conteúdo original do jogo deve ser entendido como não oficial.


### Abrir sem o Vite

Também é possível abrir o projeto com `python3 -m http.server 8000` na pasta do projeto e acessar `http://localhost:8000`. O Phaser está incluído localmente e as imagens usam caminhos relativos, então o servidor simples não precisa transformar os módulos.
