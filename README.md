# Jogo-de-Jojo-com-todas-as-partes-de-jojo-
Jogo para a eletiva sobre Jojo e todos as suas partes

## Eternal Destiny

Protótipo jogável de combate top-down feito com Phaser 3, física Arcade, Vite, CSS e JavaScript. Phaser controla a cena, a escala responsiva, o teclado, os corpos de colisão e o ciclo de atualização; o renderizador 2D em pixel art existente foi preservado como textura da cena. O repositório original só continha este README, então não havia engine ou sistemas anteriores a substituir.

Requisitos: Node.js 20.19+ e npm. Execute `npm install` e `npm run dev`; abra o endereço local apresentado pelo Vite. Para gerar a versão de produção, execute `npm run build`. Execute `npm test` para verificar o catálogo e as regras de progressão.

### Deploy

O workflow `.github/workflows/deploy.yml` executa `actions/configure-pages`, roda `npm test` e publica a pasta `dist` no GitHub Pages a cada push para `main`. **Na primeira configuração, altere manualmente a fonte do Pages:** abra **Settings → Pages → Build and deployment → Source** e selecione **GitHub Actions**. Enquanto a fonte estiver como **Deploy from a branch**, o GitHub inicia um segundo deployment `pages-build-deployment`, que compete com este workflow e causa o erro “deployment in progress”. Depois da troca, acompanhe os jobs **build** e **deploy** na aba **Actions**. O Vite configura automaticamente o subcaminho do repositório, mantendo assets e sprites acessíveis. Execuções antigas deste workflow são canceladas para evitar concorrência entre pushes.

### Controles

- `W`, `A`, `S`, `D` ou setas: movimentar
- `Shift`: correr; `Q`: dash com breve invulnerabilidade e recarga
- `J` ou espaço: ataque básico na direção do movimento
- `1` a `4`: ativar os poderes mostrados na interface
- `F`: interagir com a pista quando estiver perto do marcador
- Botão **CONTINUAR**: avançar cenas, exploração, objetivos e consequências
- `E` ou o botão **ASSISTÊNCIA**: chamar aliado durante a fase 2 da batalha secreta
- Em telas de celular, um joystick virtual controla a movimentação e o botão **ATACAR** executa o golpe básico. Os poderes também podem ser ativados tocando nos botões da interface.
- O jogo seleciona os controles táteis ou de teclado conforme o tamanho da janela e o tipo de ponteiro; redimensionar a tela atualiza a seleção.
- Botão `♪`: ativar ou silenciar efeitos sonoros
- Botão **TELA CHEIA**: entrar ou sair do modo de tela cheia do navegador.
- Na abertura, clique em **INICIAR JORNADA** ou pressione uma tecla para abrir a seleção dos modos. O botão **MODOS DE JOGO** permite voltar à seleção durante o jogo.
- O menu de História mostra as campanhas e o capítulo atual; apenas capítulos liberados podem ser iniciados.
- No Versus local, escolha um personagem para cada jogador: P1 usa `WASD`, `J`, `Q` e `Shift`; P2 usa as setas, `Enter`, `Numpad 0` (ou `Ctrl` direito) e `Shift` direito.
- Em telas sensíveis ao toque, o joystick controla o movimento; **CORRER** e **DASH** ficam ao lado dele.

### Progressão

As campanhas de Jonathan, Joseph, Jotaro, Josuke, Giorno, Jolyne, Johnny, Gappy e Jodio são definidas em `campaigns.js`. As fases têm objetivos investigáveis, oponentes, paletas e obstáculos próprios, diálogos de entrada/encontro/vitória, rotas, consequências e recompensas. A campanha de Josuke inclui Kosaku Kawajiri antes do confronto final com Yoshikage Kira. O progresso percorre `INTRO`, exploração, objetivo, encontro, combate, pós-batalha, mudança ambiental e desbloqueio; objetivos e vitórias fora da fase atual não avançam a história.

Concluir uma campanha libera a seguinte. The JOJOLands termina nos capítulos representados e permanece aberta, sem inventar um final oficial. Completar as nove campanhas libera a história secreta, que apresenta uma revanche por Parte em ordem, com 50% a mais de vida e dano no chefe. Depois das nove revanches, Jotaro, Kakyoin e Jolyne enfrentam DIO Over Heaven e Pucci. A segunda fase aumenta vida e dano dos chefes para três vezes os atributos-base, desperta Star Platinum: Over Heaven e libera os poderes supremos. Kakyoin tem as assistências próprias Emerald Splash e Hierophant Green · Barrier.

Vitórias, inimigos derrotados, objetivos, diálogos vistos, caminhos, recompensas e capítulo atual são registrados no `localStorage`. Reabrir o jogo retoma a etapa salva. Transições e eventos são idempotentes. O botão **REINICIAR PROGRESSO** apaga o progresso e desbloqueios deste navegador.

O Phaser Arcade movimenta protagonista e inimigos com hitboxes reais, apresenta golpes telegrafados por padrões, limita o movimento à arena e testa os ataques contra os corpos físicos. A cena registra os retratos tratados como texturas Phaser e desenha a textura Canvas no ciclo do engine.

### Sprites

O registro `sprite-assets.js` associa protagonistas a `Jojo-Sprite/Protagonista`, chefes finais a `Chefe-Final`, antagonistas a `Boss-Secundário`, aliados a `Aliados-do-Protagonista` e DIO Over Heaven a `Chefe-Secreto`. A busca ignora diferenças entre maiúsculas, acentos, espaços e sufixos comuns; também inclui aliases para nomes como `JotaroAnime3`, `Johnny_anime_png`, `Wii A Zeppiin`, `Kosaku Kawajiri` e `Wonder Of You + Toru`. Se não encontra correspondência na pasta esperada, mantém o fallback em vez de mostrar outra pessoa.

Os arquivos com extensão `.jpeg` são carregados conforme a assinatura real (JPEG, PNG ou WebP). Retratos com fundo claro têm apenas os pixels claros conectados às bordas removidos durante a preparação; os arquivos originais não são alterados. Os protagonistas usam as tiras de quatro quadros em `public/pixel-sprites/animations/Protagonista`: idle, caminhada, golpe e habilidades individuais. As spritesheets disponíveis no projeto irmão foram copiadas para o jogo principal; o carregamento de animações nunca usa um quadro de ataque como quadro de caminhada. Nas Partes 3–9, um Stand pixelado animado acompanha o protagonista. Os inimigos e DIO Over Heaven usam os retratos disponíveis em suas pastas, com movimento e ataques animados pelo jogo; não há spritesheets de animação para esses personagens no repositório.

A arena ocupa a janela inteira em telas grandes, sem moldura verde, e usa uma interface escura com detalhes dourados inspirada em jogos de luta de JoJo.

### Abertura e menus

A tela inicial usa a arte de capa local como fundo e apresenta o título **JoJo's Bizarre Adventure: Eternal Destiny**. A tela de seleção reaproveita o catálogo de modos local em `rohan-modes.js`, com destaque visual para cada opção; modos que ainda exigem servidor ou estão em desenvolvimento continuam identificados como tal. A tela cheia usa a API nativa do navegador e informa quando ela não está disponível.

O menu de História apresenta as campanhas e a rota dos capítulos, respeitando o progresso salvo. O menu Versus permite escolher dois dos nove protagonistas e iniciar um duelo local para duas pessoas no teclado. Ao iniciar pela abertura, o jogo solicita tela cheia; essa solicitação depende da permissão do navegador.

Os cenários top-down usam conjuntos de elementos próprios para cada fase, com camadas de fundo, piso e objetos em perspectiva 2.5D. Mansão, ruas, cassino, prisão, praia, trem, ruínas, áreas naturais, hospital e outros locais são desenhados conforme o capítulo; incêndio, chuva e neve alteram a apresentação das fases relacionadas.

Diálogos de entrada, encontro e vitória avançam automaticamente após cinco segundos; o botão permite avançar antes. O botão de áudio ativa efeitos sintetizados e uma trilha de batalha original gerada localmente pelo Web Audio. Não há gravações da trilha sonora oficial no repositório.

### Limites do protótipo

Esta é uma primeira versão jogável das campanhas: as fases são missões resumidas com diálogos escritos, não adaptações completas cena a cena. As animações de retrato e Stand são geradas no jogo a partir das imagens de referência, não são spritesheets originais. Não há áudio oficial de JoJo nem mapas completos. Conteúdo original do jogo deve ser entendido como não oficial.


### Abrir sem o Vite

Também é possível abrir o projeto com `python3 -m http.server 8000` na pasta do projeto e acessar `http://localhost:8000`. O Phaser está incluído localmente e as imagens usam caminhos relativos, então o servidor simples não precisa transformar os módulos.
