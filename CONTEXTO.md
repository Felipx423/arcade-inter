# Pega! — contexto para continuidade

Atualizado em 31/10/2026. Este commit publica o estado de trabalho por pedido expresso do usuário; não é uma entrega aprovada de performance.

## Estado e restrições

- Objetivo pendente: atingir pelo menos 30 FPS reais em movimento e no ciclo completo de captura, preservando a qualidade visual. Última captura: 15,73 FPS, P95 90,3 ms e P99 105,1 ms, com outros agentes de IA ativos no computador. Não declarar a otimização concluída.
- O usuário preservará esses trabalhos em segundo plano e avisará quando puderem ser encerrados para uma medição limpa. Não encerrar processos ou abas dele.
- Não reduzir indiscriminadamente resolução, sombras, reflexos, geometria, cápsulas ou animações. Não mascarar desempenho com limite de atualização.
- Publicação desta fotografia de trabalho foi autorizada depois do bloqueio de entrega. A distribuição final e o ZIP continuam pendentes da validação.

## Onde continuar

- Fonte de trabalho: `C:\Users\osmarcarvalho-ieg\Documents\Codex\2026-10-20\p\work\pega-3d` (cópia sem .git).
- Entrega anterior em `C:\Users\osmarcarvalho-ieg\Documents\Pega\projeto` e `distribuicao`; não foi sincronizada com a otimização experimental.
- Repositório público: https://github.com/Felipx423/arcade-inter . Usar o plugin GitHub, conforme pedido do usuário; não usar gh CLI.
- Arquivo principal de auditoria: `qa/performance/STATUS.md`. Ele documenta arquitetura, evidências, limitações e o protocolo seguinte.

## Execução e testes

Node disponível nesta máquina: `C:\Users\osmarcarvalho-ieg\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe`.

Com Node no PATH, instalar com `npm ci`; testar com `npm test`; gerar build com `npm run build`. O build pronto em `dist` funciona com `node server.cjs`/`iniciar.cmd`, sem instalação ao abrir. Não depende de CDN.

Para QA com animação completa: `node node_modules/vite/bin/vite.js build --mode performance-qa --outDir qa/performance/full-motion-dist`; definir `PEGA_QA_PORT=4179` e executar `node qa/performance/server-optimized.cjs`.

- 4173: outro projeto, não interromper.
- 4174: Pega original/dev com estoque real. Nunca fazer sorteios de teste nessa origem.
- 4177: baseline local (pasta `qa/performance/baseline-dist`, não sobrescrever).
- 4178: candidata normal (`dist`), estoque fictício isolado.
- 4179: QA de captura completa, estoque fictício isolado. Última página aberta ao usuário: http://127.0.0.1:4179/?noShadowCache .
- `?profile` habilita instrumentação. `noShadowCache` desliga um cache experimental de sombras; não desliga as sombras. `noStaticCache` permite A/B do cache de objetos fixos.

## Regras funcionais preservadas

React/TypeScript/Vite/Three/Fiber/Drei com versões fixadas. IndexedDB `maquina-de-brindes-v1`, fotos locais, sorteio ponderado por unidades e transação atômica de baixa + resultado antes da animação. Atualização recupera o prêmio sem nova baixa. Joystick em dois eixos, teclado/toque, captura sempre bem-sucedida e independente da mira. Não alterar dados reais ao testar. O conteúdo do banco do navegador não integra o repositório.

## Otimizações e riscos

Memoização da cena fixa, lotes opacos, instâncias de cilindros, BatchedMesh para peças móveis, recursos compartilhados de cápsulas, avaliação seletiva de luzes de contribuição nula, recorte conservador do pré-passe de transmissão e preparação assíncrona de shaders. Física e animações não foram reduzidas.

Os caches de radiância fixa, oclusão e profundidade de sombras são experimentais. Confirmar fidelidade de bordas, vidro e sombras em comparação visual. Memória nominal do cache omite o custo extra de MSAA. Preparação de shaders chegou a cerca de 40 segundos sob carga. A última captura manteve o cache de sombras desligado.

Profiling usa Performance API, renderer.info e consultas GPU assíncronas. Tempos por passe são inclusivos: não somar. A última consulta GPU teve uma só amostra e foi corrigida posteriormente; não apresentá-la como GPU média confiável. O experimento de 22,4 FPS tinha um defeito de sombras corrigido depois e não é resultado aprovado. Baseline e candidata antigos diferem em carga, DPR e estoque; não calcular ganho final entre eles.

## Validação restante

1. Repetir baseline e candidata aquecidas com mesma viewport, DPR, estoque e apenas uma aba gráfica ativa, sem builds/testes em paralelo.
2. Comprovar 30 FPS em movimento e captura inteira; revisar P95/P99 e travamentos.
3. Comparar materiais, sombras, vidro e enquadramento, inclusive fases intermediárias da garra, desktop e celular.
4. Retestar após alterações, só então atualizar a entrega em Documentos e o ZIP.

Evidências funcionais anteriores: 35 testes passaram; captura 9→8, recarregamento manteve resultado/8, próximo sorteio não debitou, outra captura 8→7. Fotos e resultado funcionaram; teclado/toque testados e viewport 390×844. Consulte JSONs para os detalhes. `step14-capture-visual.jpg` mostra resultado final, não contato intermediário da garra. PNGs vazios antigos não servem como prova visual. A internet não foi fisicamente desligada durante a validação.

## Conteúdo publicado

Fontes, testes, recursos locais, build normal atual, relatórios e evidências de QA. `node_modules`, bancos locais, caches e cópias repetidas de builds de QA não são versionados. Para reconstruir o baseline, usar o código anterior à otimização no histórico Git; o baseline local preservado permite comparação imediata nesta máquina.
