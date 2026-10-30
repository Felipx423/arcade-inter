# Recursos locais e licenças

Todos os arquivos usados pela aplicação são servidos localmente; não há CDN, fonte remota ou modelo 3D remoto.

## Geometria
Gabinete, trilhos, garra articulada, controles, cápsulas, arcades e piso são modelados por código em `src/SceneObjects.tsx` e `src/MachineScene.tsx`. Não foram incorporados modelos externos.

## Imagens geradas para este projeto
Geradas e revisadas com OpenAI ImageGen, sem fotografias ou personagens externos incorporados:

- `public/textures/enamel-wear.png`: pintura creme envelhecida, riscos e lascas irregulares, iluminação difusa neutra, textura sem perspectiva. Aplicada a cor, rugosidade e relevo dos materiais.
- `public/textures/poster-wall.png`: colagem original de cartazes japoneses de arcade antigo, sem marcas reconhecíveis. Aplicada às paredes e detalhes do gabinete.
- `public/textures/arcade-screen.png`: luta em pixel art, personagens originais, cenário noturno, barras de energia, CRT 4:3, sem gabinete na imagem.
- `public/textures/arcade-space-screen.png`: jogo espacial em pixel art, inimigos originais e nave ciano, CRT 4:3, sem marcas ou personagens existentes.
- `public/textures/neon-game-sign.png`: letreiro vertical rosa ゲーム, fundo escuro, projeção ortogonal 1:3.

Estas imagens não são bibliotecas de terceiros com licença Creative Commons. Foram geradas para compor esta entrega; não há atribuição externa de fotografia/modelo a fazer. Os jogos são apenas texturas decorativas, não jogos adicionais.

## Fonte e ícones
- Quicksand variável, Google Fonts: https://github.com/google/fonts/tree/main/ofl/quicksand — SIL Open Font License 1.1, cópia integral em `licenses/Quicksand-OFL.txt`.
- Phosphor Icons, variante regular: https://github.com/phosphor-icons/core — MIT, cópia integral em `licenses/Phosphor-MIT.txt`. SVGs em `public/icons/`.
- `FONT-LICENSE.txt` registra a fonte Three.js da versão anterior, mantida apenas como documentação histórica.

## Fotos e exemplos
As fotos de brindes são enviadas pelo operador e armazenadas em seu navegador. As três ilustrações SVG de exemplo locais são do projeto anterior. Não são carregadas automaticamente.

As licenças das bibliotecas npm acompanham seus pacotes; as versões estão fixadas em `package-lock.json`.
