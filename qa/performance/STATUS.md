# Auditoria de performance — trabalho em validação

**A meta de 30 FPS ainda não foi atingida/comprovada. Em 31/10/2026 o usuário autorizou publicar o estado de trabalho e o contexto no GitHub. Esta publicação não constitui entrega aprovada; a distribuição final e o ZIP permanecem pendentes.**

## Condições e evidências

- GPU observada: Intel UHD Graphics, ANGLE/D3D11. Medições pelo navegador local.
- Baseline preservado em `baseline-dist`; não sobrescrever esse diretório.
- `baseline-movement-warm.json`: 10,82 FPS; frame médio 92,45 ms; P95 112,7 ms; P99 116,6 ms; aproximadamente 1.292 draw calls. Esse registro usava DPR 1,25 e buffer 1600 × 900.
- `baseline-current-conditions.json`: original caiu para 3,91 FPS com DPR 1 e buffer 1280 × 720. O usuário confirmou vários agentes de IA trabalhando em segundo plano. A carga externa não foi interrompida.
- `step14-capture-under-background-load.json`: ciclo completo de 5,56 s, 9 unidades fictícias; 15,73 FPS; frame médio 63,57 ms; P95 90,3 ms; P99 105,1 ms; média de 192 draw calls. A consulta de GPU retornou uma amostra, insuficiente para caracterizar o ciclo. A consulta foi ajustada depois para recolher resultados assíncronos sem esperar mais 30 frames.
- Os registros acima têm DPR, estoque e/ou condições de carga diferentes. **Não constituem um comparativo final de ganho.**
- O experimento `step7-static-pbr.json`, de 22,40 FPS, tinha um defeito de sombras fixas posteriormente corrigido. Não usá-lo como resultado aprovado.

## Diagnóstico da arquitetura

O trabalho dominante era a renderização: dois refletores planares com dez passes de blur, pré-passes de transmissão e muitas submissões individuais de peças com materiais equivalentes. O ciclo completo continua com 13 chamadas a `renderer.render` por frame; contadores incluem também draws internos de sombra e transmissão. Não há bloom/composer nem sistema de partículas nesta implementação.

A física usa passo fixo de 120 Hz, até 12 cápsulas e repouso. No ciclo registrado, física e animação custaram aproximadamente 0,22 e 0,25 ms por frame. Não foram reduzidos os passos, as colisões ou as animações para obter FPS. Esses dados não sustentam uma reescrita do simulador como solução principal.

A recaptura do ambiente e a recriação de recursos em atualizações de mira foram evitadas com componentes estáticos memoizados. Peças opacas compatíveis compartilham lotes mantendo vértices, normais, UVs, mapas e parâmetros PBR. Cores são mantidas em espaço linear. Cilindros móveis usam instâncias; outros objetos móveis opacos usam `BatchedMesh`. As geometrias originais continuam disponíveis ao raycast e à edição. Vidros e a cápsula que muda de material durante a captura ficam separados.

O shader evita avaliar contribuições de luz comprovadamente nulas; a atenuação quadrática mantém a equação original. O pré-passe de transmissão conserva resolução, MSAA, mipmaps e uma margem conservadora, com fallback para o passe completo em materiais desconhecidos. Recursos das cápsulas são compartilhados e descartados uma vez. Fotos continuam locais, limitadas a 512 × 512, com descarte da textura e revogação da URL.

O cache de radiância de objetos fixos conserva sombra direcional atualizada, mas ainda exige comparação final de bordas e sombras. Seus quatro alvos HalfFloat têm memória adicional de MSAA não incluída no contador nominal `bytes`. O cache de profundidade das sombras também é experimental e tem custo de cópia; a última captura usou `noShadowCache`. Decidir sua permanência por A/B em carga estável, sem pressupor benefício.

## Instrumentação atual

`?profile` expõe tempos de frame, média/P95/P99, CPU, GPU assíncrona, física, animação, draws, triângulos, geometrias, texturas, materiais, programas, estimativas de memória e recursos carregados. Apenas intervalos de frame são convertidos em FPS. O tempo total de renderização conta a chamada externa uma vez; tempos individuais de passes são inclusivos e não devem ser somados.

A medição é bloqueada até concluir a preparação da GPU. Falha de renderização e ausência de frames geram relatório inválido, sem FPS artificial. A captura mede o ciclo inteiro e só é habilitada em origem de QA, com estoque fictício e animação completa. Não iniciar um sorteio em 4174.

## Verificações realizadas

- 35 testes automatizados passaram; TypeScript sem erros na última checagem.
- No navegador em 4179: captura de exemplo com comandos bloqueados, resultado com foto/nome e uma única baixa (9 → 8); recarregamento recuperou o mesmo resultado e 8 unidades; Próximo sorteio manteve as 8 unidades; segunda captura entregou outro exemplo (8 → 7).
- Teclado e botões de direção alteraram os dois eixos. Em viewport 390 × 844, máquina e comandos principais permaneceram visíveis; controles principais com pelo menos 44 × 44 px. Viewport temporário restaurado.
- Nenhum erro de console nas verificações registradas. Recursos observados eram da própria origem local. A internet não foi desligada para preservar os trabalhos em segundo plano.
- Capturas válidas: `step14-desktop.jpg`, `step14-result.jpg`, `step14-mobile-result.jpg`. `step14-capture-visual.jpg` é um resultado final, não prova de todas as fases da garra. Alguns PNGs antigos vazios não servem como evidência visual.
- Armazenamento, probabilidades e simulador não foram alterados. Testes de transação, último item, falha controlada, concorrência e reabertura permanecem passando.

## Próxima validação indispensável

Quando o usuário avisar que os agentes terminaram: medir baseline e candidata com a mesma viewport, DPR, estoque e estado aquecido, uma única aba gráfica ativa e sem builds/testes simultâneos. Repetir movimento e captura completa. Exigir pelo menos 30 FPS reais em ambos e revisar P95/P99, hitches, sombras e transparência. Comparar capturas no mesmo enquadramento, incluindo fases intermediárias da garra. Revalidar a versão final após qualquer alteração.

Só depois desse resultado atualizar a distribuição final em Documentos, as instruções de entrega e o ZIP. O GitHub recebeu uma fotografia de trabalho por autorização posterior do usuário; consultar CONTEXTO.md. O projeto de trabalho permanece isolado em `work/pega-3d`.

## Ambiente isolado de captura

O build normal respeita movimento reduzido. Para testes completos existe um build separado: `vite build --mode performance-qa --outDir qa/performance/full-motion-dist`. A exceção de animação fica restrita a `127.0.0.1:4179`. Servir com `PEGA_QA_PORT=4179` e `node qa/performance/server-optimized.cjs`. O servidor padrão desse arquivo continua em 4178 e serve `dist`. O banco permanece separado pela origem; não copiar registros para o endereço real.
