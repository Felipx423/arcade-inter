import { staticViewMetrics } from './static-view';
import { staticShadowMetrics } from './static-shadows';
import { shaderWarmupMetrics } from './useShaderWarmup';
import { transmissionMetrics } from './transmission';
import { batchMetrics } from './batching';
import { animatedBatchMetrics } from './animated-batching';
import { cylinderMetrics } from './DynamicCylinders';
import { useEffect, useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { frameCosts, statistics, summarize } from './performance.mjs';
import type { Aim,Capture } from './types';
import {prefersReducedMotion} from './motion';

type Sample = { start: number; previous: number; requested:number; mode: string; ticks: number; frame: number[]; cpu: number[]; gpu: number[]; physics: number[]; animation: number[]; render: number[]; calls: number[]; triangles: number[]; passes: number[]; queries: WebGLQuery[] };
export default function PerformancePanel({ ready,onAim,onGrab,capture,canCapture,onError }: { ready:boolean;onAim: (aim: Aim) => void;onGrab:()=>void;capture:Capture|null;canCapture:boolean;onError:()=>void }) {
  const { gl, scene, camera, invalidate, size } = useThree();
  const current = useRef<Sample | null>(null);
  const [report, setReport] = useState('Pronto para medir. Use uma porta de testes, nunca o estoque real.');
  const started = useRef(0), renderMs = useRef(0), passCount = useRef(0);
  const context = gl.getContext() as WebGL2RenderingContext;
  const extension = useRef(context.getExtension('EXT_disjoint_timer_query_webgl2'));
  const activeQuery = useRef<WebGLQuery | null>(null);
  const originalRender = useRef(gl.render);
  const passCosts = useRef<Record<string, number[]>>({});
  const collectGPU=(s:Sample)=>{
    const ext=extension.current;if(!ext)return;
    while(s.queries.length && context.getQueryParameter(s.queries[0],context.QUERY_RESULT_AVAILABLE)){
      const q=s.queries.shift()!;
      if(!context.getParameter(ext.GPU_DISJOINT_EXT))s.gpu.push(context.getQueryParameter(q,context.QUERY_RESULT)/1e6);
      context.deleteQuery(q);
    }
  };
  useEffect(() => {
    const original = gl.render;
    originalRender.current = original;
    let depth=0;
    gl.render = function (...args) {
      const start=performance.now(),topLevel=depth++===0,target=gl.getRenderTarget();
      const label=`${target?`${target.width}x${target.height}`:'screen'}:${args[0].children.length} objects`;
      passCount.current++;
      try{return original.apply(gl,args);}finally{
        depth--;const duration=performance.now()-start,s=current.current;
        if(topLevel)renderMs.current+=duration;
        if(s?.start && start-s.start>(s.mode==='captura'?0:1500))(passCosts.current[label]??=[]).push(duration);
      }
    };
    const autoReset = gl.info.autoReset;
    gl.info.autoReset = false;
    return () => { gl.render = original; gl.info.autoReset = autoReset; const s = current.current; s?.queries.forEach(q => context.deleteQuery(q)); };
  }, [gl, context]);
  const finish = (s: Sample) => {
    collectGPU(s);
    if(!s.frame.length || !s.calls.some(c=>c>0)){
      s.queries.forEach(q=>context.deleteQuery(q));current.current=null;
      setReport('Medição inválida: não foram registrados frames renderizados. Nenhum resultado de FPS foi produzido.');return;
    }
    const materials = new Set<THREE.Material>(); const geometries = new Set<THREE.BufferGeometry>(); const textures = new Set<THREE.Texture>();
    scene.traverse(object => { const mesh = object as THREE.Mesh; if (mesh.geometry) geometries.add(mesh.geometry); if (mesh.material) for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) { materials.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) textures.add(value); } });
    let geometryBytes = 0, textureBytes = 0;
    for (const g of geometries) { for (const a of Object.values(g.attributes)) geometryBytes += a.array.byteLength; geometryBytes += g.index?.array.byteLength ?? 0; }
    for (const t of textures) { const image = t.image as { width?: number; height?: number } | undefined; textureBytes += (image?.width ?? 0) * (image?.height ?? 0) * 4 * (t.generateMipmaps ? 4 / 3 : 1); }
    const heap = (performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } }).memory;
    const debug = context.getExtension('WEBGL_debug_renderer_info');
    const output = { staticViewMetrics, shaderWarmupMetrics, transmissionMetrics, passCosts: Object.fromEntries(Object.entries(passCosts.current).map(([k,v]) => [k, statistics(v)])), batchMetrics, mode: s.mode, durationMs: performance.now() - s.start, viewport: [size.width, size.height], drawingBuffer: [gl.domElement.width, gl.domElement.height], dpr: gl.getPixelRatio(), frameMs: summarize(s.frame), cpuFrameMs: statistics(s.cpu), renderSubmissionMs: statistics(s.render), gpuMs: s.gpu.length ? statistics(s.gpu) : null, physicsMs: statistics(s.physics), animationMs: statistics(s.animation), drawCalls: statistics(s.calls), triangles: statistics(s.triangles), renderPasses: statistics(s.passes), geometries: gl.info.memory.geometries, textures: gl.info.memory.textures, materials: materials.size, shaders: gl.info.programs?.length ?? 0, sceneGeometryBytes: geometryBytes, estimatedSceneTextureBytes: textureBytes, heap: heap ? { used: heap.usedJSHeapSize, allocated: heap.totalJSHeapSize } : null, gpu: debug ? context.getParameter(debug.UNMASKED_RENDERER_WEBGL) : context.getParameter(context.RENDERER), timerSupported: Boolean(extension.current), resources: performance.getEntriesByType('resource').map(e => ({ name: e.name, duration: e.duration })), notes: 'Render submission measures only the outer renderer call, including its nested passes once. Individual passCosts are inclusive and must not be added together. GPU queries are asynchronous and sampled every 30 frames; absent means unavailable, not zero. Texture memory estimate excludes driver/MSAA/render-target allocations. FPS is derived only from frame intervals.' };
    Object.assign(output,{staticShadowMetrics,animatedBatchMetrics,cylinderMetrics,camera:{position:camera.position.toArray(),projection:camera.projectionMatrix.toArray()},glViewport:Array.from(context.getParameter(context.VIEWPORT))});
    setReport(JSON.stringify(output, null, 2));
    s.queries.forEach(q => context.deleteQuery(q)); current.current = null;
  };
  useFrame(() => {
    started.current = performance.now(); renderMs.current = 0; passCount.current = 0; frameCosts.physics = frameCosts.animation = 0; gl.info.reset();
    const s = current.current; if (!s) return;
    const now = performance.now();
    if(s.mode==='captura' && !capture){
      if(s.start)finish(s);
      else if(now-s.requested>15000){current.current=null;setReport('A captura não iniciou. Nenhum resultado de FPS foi produzido.');}
      return;
    }
    if (!s.start) { s.start = now; s.previous = now; }
    const ext = extension.current;
    collectGPU(s);
    if (ext && s.ticks++%30===0 && now-s.start>(s.mode==='captura'?0:1500)) {
      if (s.queries.length < 8) { activeQuery.current = context.createQuery(); context.beginQuery(ext.TIME_ELAPSED_EXT, activeQuery.current); }
    }
    if (s.mode === 'movimento') { const t = (now - s.start) / 1000; onAim({ x: Math.sin(t * 1.8) * 1.1, z: Math.cos(t * 1.4) * .7 }); }
  }, -1000);
  useFrame(() => {
    try{gl.render(scene, camera);}catch(error){
      const s=current.current;
      if(activeQuery.current && extension.current){context.endQuery(extension.current.TIME_ELAPSED_EXT);context.deleteQuery(activeQuery.current);activeQuery.current=null;}
      s?.queries.forEach(q=>context.deleteQuery(q));current.current=null;
      setReport(`Renderização interrompida: ${String(error)}. Medição inválida.`);onError();return;
    }
    const s = current.current; if (!s) return;
    if(!s.start){invalidate();return;}
    if (activeQuery.current && extension.current) { context.endQuery(extension.current.TIME_ELAPSED_EXT); s.queries.push(activeQuery.current); activeQuery.current = null; }
    const now = performance.now();
    if (s.previous && now - s.start > (s.mode==='captura'?0:1500)) { s.frame.push(now - s.previous); s.cpu.push(now - started.current); s.render.push(renderMs.current); s.physics.push(frameCosts.physics); s.animation.push(frameCosts.animation); s.calls.push(gl.info.render.calls); s.triangles.push(gl.info.render.triangles); s.passes.push(passCount.current); }
    s.previous = now;
    if (s.mode!=='captura' && now - s.start >= 11500) finish(s); else invalidate();
  }, 1000);
  const isolated=['4177','4178','4179'].includes(location.port);
  const captureAllowed=isolated && canCapture && !prefersReducedMotion();
  const start = (mode: string) => { if (!ready || current.current || (mode==='captura' && !captureAllowed)) return; passCosts.current = {}; current.current = { start: 0, previous: 0, requested:performance.now(), mode, ticks:0, frame: [], cpu: [], gpu: [], physics: [], animation: [], render: [], calls: [], triangles: [], passes: [], queries: [] }; setReport(mode==='captura'?'Medindo o ciclo completo no estoque de testes…':'Medindo 10 s após 1,5 s de aquecimento…');if(mode==='captura')onGrab(); invalidate(); };
  const measuring=Boolean(current.current);
  const captureReason=!isolated?'A captura de diagnóstico só é permitida nas portas de testes.':prefersReducedMotion()?'O ciclo completo exige o ambiente de QA com animação habilitada.':!canCapture?'A máquina precisa estar pronta, com estoque de testes e sem resultado pendente.':'';
  return <Html fullscreen zIndexRange={[9999, 9999]} style={{ pointerEvents: 'none' }}><details open style={{ pointerEvents: 'auto', position: 'absolute', top: 75, left: 12, maxWidth: 'min(460px, 94vw)', maxHeight: '70vh', overflow: 'auto', background: '#101520f5', color: 'white', padding: 12, font: '12px monospace', border: '1px solid #56d867' }}><summary>Diagnóstico de performance</summary><button disabled={!ready||measuring} onClick={() => start('cena renderizada')}>Medir cena</button><button disabled={!ready||measuring} onClick={() => start('movimento')}>Medir movimento</button><button disabled={!ready||measuring||!captureAllowed} title={captureReason} onClick={() => start('captura')}>Medir captura</button>{!ready&&<p>Preparando os shaders e os buffers da GPU…</p>}{captureReason&&<p>{captureReason}</p>}<pre id="performance-report" style={{ whiteSpace: 'pre-wrap' }}>{report}</pre></details></Html>;
}
