# Pega! — revisão visual e funcional

Data: 30/10/2026. Referência: imagem enviada pelo usuário, `codex-clipboard-63ee1e0e-c9a5-4bdb-864a-02a16699e11a.png`, 1673 × 942.

## Resultado

**final result: blocked — equivalência fotográfica ainda não atingida.** A reconstrução funcional está implementada e o build foi validado. A composição foi aproximada, mas as diferenças P2 abaixo impedem declarar fidelidade visual completa. Não há dependência de uma aprovação para usar a implementação entregue.

## Comparação

Referência e captura da implementação foram inspecionadas juntas, no mesmo contexto de análise. Captura desktop: `previas/desktop.jpg`, viewport 1674 × 942 (arredondamento de um pixel do navegador). Estado: rodada livre, 12 unidades de exemplos em origem de testes. Captura móvel: `previas/celular.jpg`, viewport 390 × 844. Captura de resultado móvel: `previas/resultado.jpg`. A imagem original está em `previas/referencia.png`.

Prioridade de revisão: enquadramento e escala; materiais/iluminação; navegação e barra de comandos; adaptação móvel.

| Achado | Prioridade | Resultado |
|---|---|---|
| Máquina antes pequena sobre fotografia de ambiente | P1 | Reconstruído: salão, gabinete e arcades laterais são geometria 3D, câmera em perspectiva fixa, cena ocupa a janela. |
| Painéis e títulos excessivos | P1 | Removidos da tela livre; navegação discreta e barra inferior única. Cadastro em diálogo lateral. |
| Textura de desgaste esticada pela geometria anterior | P2 | Corrigido com RoundedBoxGeometry e UVs normalizados; material local com cor, rugosidade e relevo. |
| Câmera elevada e vitrine com proporção diferente | P2 | Ajustada em iterações: frontal com perspectiva leve, máquina próxima, painel à altura do jogador. |
| Saída atravessava volume sólido da base | P1 | Base reconstruída em painéis com abertura e trajeto interno contínuo da cápsula até a saída. |
| Fotorealismo dos materiais | P2 aberto | Pintura e vidro continuam mais limpos e uniformes que a referência; reflexos simplificados, sem a mesma densidade de riscos e poeira da fotografia. |
| Fundo e detalhes do salão | P2 aberto | Cartazes e jogos são originais e diferentes da imagem; reflexão traseira é simplificada. A sala não replica cada objeto da fotografia. |
| Quantidade de cápsulas | Diferença deliberada | Até 12 cápsulas físicas representam o estoque real; a referência tem uma pilha muito mais densa. Não foram inventadas unidades no estoque real. |
| Garra metálica | P3 aberto | Dedos articulados e curvos, cabo e trilhos reais; mecanismo tem menos microdetalhes que a referência. |

## Iterações

1. Substituição do cenário fotográfico por sala, piso e arcades tridimensionais; novos materiais e interface.
2. Ajuste da câmera, dimensões do gabinete e botão; telas CRT locais com artes originais.
3. Correção dos UVs da pintura; ajuste da altura da vitrine e trilhos.
4. Separação dos jogos laterais, cartazes na lateral do gabinete, letreiro de néon local e traseira reflexiva com cartazes.
5. Ajuste fino da perspectiva e verde iluminado; validação desktop, viewport móvel e versão compilada.

## Verificações executadas

- `npm test`: 15/15 testes, zero falhas. Cobrem limites nos dois eixos, seleção, gravidade/colisões/repouso, impulso, chances 10:1 com valores controlados, vazio/última unidade, concorrência, rollback, cadastro/fotos/reposição/exclusão e reabertura do banco.
- `npm run build`: TypeScript e Vite concluídos.
- Navegador, origem isolada `127.0.0.1:4175`: cadastro com PNG local, troca por outro PNG, reposição e exclusão com confirmação; exemplos e fotos visíveis.
- Joystick por teclado e botões de direção alterou horizontal e profundidade; botões principais medidos com altura mínima 44 px.
- Captura completou e revelou nome/foto; durante a rodada os comandos ficaram desabilitados. Clique duplo não descontou duas unidades.
- Atualização após iniciar captura recuperou resultado e apenas uma baixa; próximo sorteio liberou a rodada sem nova baixa.
- Resultado Caneca e estoque de 9 unidades preservados após fechar e reabrir a aba de testes. O teste automatizado também fecha e reabre a conexão do IndexedDB com resultado salvo.
- A origem real em 4174 foi apenas inspecionada; nenhum sorteio de validação foi realizado nela. `store.mjs` e `random.mjs` mantêm os mesmos hashes da entrega anterior.
- Build servido com a mesma implementação de `server.cjs` em porta de teste 4176: HTML, fonte TTF, SVGs e as cinco texturas responderam 200; cena renderizou e estoque vazio bloqueou Pegar.
- Recursos de execução locais; sem CDN/preset remoto de ambiente. Não foi desligada fisicamente a rede deste computador, portanto essa condição não é apresentada como teste executado.
- Sem erros de console nas cargas finais verificadas. Durante a inclusão da configuração de QA houve uma falha transitória de hot reload, corrigida com guarda de disponibilidade e recarga; ela não permanece na versão pronta. Há avisos de depreciação de THREE.Clock e, em algumas compilações de shader no computador, arredondamento numérico do driver; não afeta a rodada. O aviso de PCFSoftShadowMap foi corrigido usando PCFShadowMap.

## Limites de evidência

Celular validado em viewport de navegador, sem teste em aparelho físico. O navegador usa movimento reduzido por padrão; esse fluxo foi validado. A animação completa também foi executada na origem isolada com `PEGA_QA_FULL_MOTION=1`, opção limitada a desenvolvimento. Foram capturadas descida, captura com cápsula presa, transporte/saída e resultado (`previas/animacao-*.jpg`). As capturas pontuais não constituem inspeção quadro a quadro de todas as articulações. Falta de espaço e falha de transação são cobertas por testes controlados, não por esgotamento de disco real. Não foi encerrado o aplicativo de navegador inteiro; foram usadas atualização/reabertura de aba e reabertura de banco em teste.

A porta 4173 já está ocupada por outro projeto neste computador. Esse processo não foi encerrado. A distribuição continua usando 4173 para preservar a identidade dos dados; a prévia editável segue em 4174.
