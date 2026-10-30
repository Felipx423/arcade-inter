# Pega! — máquina de brindes 3D

## Versão visual: arcade retrô

A tela de jogo agora fica em um salão de arcade iluminado em azul, com máquinas clássicas nas laterais e a máquina Pega! em destaque no centro. O gabinete 3D usa azul `#001D89`, creme `#FFF8E1` e verde `#56D867`; o salão, as máquinas laterais, o gabinete e os controles são geometria 3D. As texturas de pintura, pôsteres e telas são arquivos locais, sem CDN.

## Abrir a máquina

1. Extraia o ZIP inteiro em uma pasta.
2. Dê dois cliques em **iniciar.cmd**. O Node.js já disponível neste computador abre o servidor e o navegador.
3. Use sempre **http://127.0.0.1:4173/** e o mesmo navegador/perfil para recuperar seus dados.
4. Mantenha a janela do servidor aberta. Ctrl+C encerra o servidor.

O build já está incluído. Não precisa instalar pacotes nem ter internet para usar. Em outro computador, é necessário ter Node.js instalado. Não abra `dist/index.html` diretamente.

## Jogar

Arraste o joystick na máquina ou na barra inferior. Também pode usar as setas, W/A/S/D e os botões de direção. Esquerda/direita alteram a posição horizontal; cima/baixo alteram a profundidade. A cápsula mais próxima recebe uma marca de mira. Pressione **Pegar** ou Enter para capturar. O botão verde da própria máquina também funciona.

A garra sempre captura uma cápsula. O prêmio é sorteado proporcionalmente ao estoque: dez canetas têm dez vezes a chance de uma camiseta. A posição da mira escolhe a cápsula física, sem alterar as chances. Até 12 cápsulas representam todo o estoque real.

O resultado fica visível até **Próximo sorteio**. Atualizar durante a animação mostra o mesmo prêmio já registrado, sem descontar novamente. Com movimento reduzido ativado no sistema, a entrega é imediata.

## Meus brindes

Cadastre nome, foto PNG/JPG/WebP de até 8 MB e quantidade inteira de 0 a 100.000. Edite nome, quantidade e foto, use **+1 unidade** para repor ou exclua com confirmação. Quantidade zero retira o item do sorteio. Os exemplos só são carregados quando solicitados e se o cadastro estiver vazio.

Cadastro, fotos, estoque e último resultado ficam no IndexedDB `maquina-de-brindes-v1`, versão 1. O formato anterior foi mantido. Os dados não ficam dentro do ZIP; limpar os dados do navegador remove o cadastro. Não há login, participantes ou compartilhamento entre aparelhos. Sem WebGL, o cadastro continua disponível e os sorteios ficam bloqueados.

## Editar o projeto

Stack: React, TypeScript, Vite, Three.js, React Three Fiber e Drei, com versões fixadas e `package-lock.json`.

- `src/App.tsx`: interface, gerenciamento, teclado e coordenação da rodada.
- `src/MachineScene.tsx`: garra articulada, controlador visual, câmera, iluminação, joystick e cápsulas.
- `src/SceneObjects.tsx`: gabinete, vidro, materiais, arcades laterais e salão modelados por código.
- `src/controller.ts`: posições, limites e seleção da cápsula.
- `src/store.mjs` / `src/random.mjs`: armazenamento transacional e sorteio, preservados da versão anterior.
- `src/types.ts` / `src/storage.ts`: tipos e integração com os serviços existentes.
- `dist/`: versão offline pronta. `server.cjs` serve somente esta pasta.

Para desenvolvimento, com internet na primeira instalação: `npm ci`, `npm run dev`. A prévia usa a porta 4174, com um cadastro separado. Rode `npm test` e `npm run build` para validar e atualizar a distribuição. Node.js 24 é recomendado para o projeto editável. A versão pronta usa apenas módulos nativos do Node.

Todos os recursos usados em execução são locais. A fonte Quicksand e os ícones Phosphor estão incorporados. Origens e licenças estão em `ASSETS.md` e `licenses/`. As fotos são reduzidas a texturas de 512 × 512 e liberadas quando substituídas. O 3D limita a densidade a 1,5 (1,25 em celular ao abrir) e usa sombras menores em telas estreitas e renderiza sob demanda quando parado.

## Interface e prévias

**Jogar** leva aos controles; **Brindes** mostra as fotos e quantidades disponíveis; **Como funciona** explica as regras; **Meus brindes** abre o cadastro. A seta ao lado do joystick abre quatro botões de direção de 44 × 44 px. A barra mostra estoque real, sem créditos pagos.

As capturas em `previas/` foram feitas com cadastro de testes separado, em desktop e viewport de celular. Não representam o estoque salvo no seu navegador. `design-qa.md` registra a comparação com a referência e diferenças que permanecem.

A distribuição mantém a porta 4173. Se outro programa a ocupar, o iniciador explica o conflito e não muda automaticamente de endereço, pois isso separaria o cadastro. A prévia de desenvolvimento em 4174 tem dados próprios.

Para validar a animação inteira quando o sistema estiver com movimento reduzido, o desenvolvedor pode iniciar apenas uma instância de testes com a variável de processo `PEGA_QA_FULL_MOTION=1` e `npm run dev -- --port 4175`. Essa opção só existe em desenvolvimento: o build pronto sempre respeita a preferência do sistema. Use uma porta separada para nunca sortear no estoque real.
