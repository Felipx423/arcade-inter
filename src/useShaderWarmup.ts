import { useLayoutEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import {compilationView} from './shader-compilation';

export const shaderWarmupMetrics = { durationMs: 0, parallel: false, materials: 0 };

/** Compile screen and linear-reflection variants before accepting interaction. */
export function useShaderWarmup(onReady: () => void, onError: () => void) {
  const { gl, scene, camera, invalidate } = useThree();
  const [ready,setReady]=useState(false);
  const state = useRef({ frames: 0, phase: 'waiting', cancelled: false, start:0, sync:null as WebGLSync|null });
  const callbacks = useRef({onReady,onError}); callbacks.current={onReady,onError};
  useLayoutEffect(()=>{
    state.current={frames:0,phase:'waiting',cancelled:false,start:0,sync:null};
    setReady(false);
    const render=gl.render;
    gl.render=function(s,c){ if(s===scene && ['waiting','compiling','failed'].includes(state.current.phase)) return; render.call(gl,s,c); };
    invalidate();
    return ()=>{state.current.cancelled=true;if(state.current.sync)(gl.getContext() as WebGL2RenderingContext).deleteSync(state.current.sync); gl.render=render;};
  },[gl,scene,invalidate]);
  useFrame(()=>{
    const s=state.current;
    if(s.phase==='priming'){
      const context=gl.getContext() as WebGL2RenderingContext;
      if(s.frames++<4){invalidate();return;}
      if(!s.sync){s.sync=context.fenceSync(context.SYNC_GPU_COMMANDS_COMPLETE,0);if(!s.sync){s.phase='failed';callbacks.current.onError();return;}context.flush();invalidate();return;}
      const status=context.clientWaitSync(s.sync,0,0);
      if(status===context.TIMEOUT_EXPIRED){invalidate();return;}
      if(status===context.WAIT_FAILED){context.deleteSync(s.sync);s.sync=null;s.phase='failed';callbacks.current.onError();return;}
      context.deleteSync(s.sync);s.sync=null;s.phase='ready';shaderWarmupMetrics.durationMs=performance.now()-s.start;setReady(true);callbacks.current.onReady();return;
    }
    if(s.phase!=='waiting') return;
    if(s.frames++<2){invalidate();return;}
    s.phase='compiling';
    s.start=performance.now();const compilation=compilationView(scene),visible=compilation.view;
    const materials=new Set<THREE.Material>();
    scene.updateMatrixWorld(true);
    for(const object of visible.children){const mesh=object as THREE.Mesh;for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.add(material);}
    shaderWarmupMetrics.materials=materials.size;
    shaderWarmupMetrics.parallel=gl.extensions.has('KHR_parallel_shader_compile');
    const linear=new THREE.WebGLRenderTarget(16,16,{type:THREE.HalfFloatType});
    const previous=gl.getRenderTarget();
    let tasks: Promise<unknown>[];
    const fog=scene.fog;
    try {
      const screen=gl.compileAsync(visible,camera,scene);
      gl.setRenderTarget(linear);
      const reflection=gl.compileAsync(visible,camera,scene);
      scene.fog=null;
      const cache=gl.compileAsync(visible,camera,scene);scene.fog=fog;
      gl.setRenderTarget(previous);
      tasks=[screen,reflection,cache];
    } catch(error){linear.dispose();compilation.release();s.phase='failed';callbacks.current.onError();console.error(error);return;}
    finally{scene.fog=fog;gl.setRenderTarget(previous);}
    void Promise.all(tasks).then(()=>{
      linear.dispose(); compilation.release();
      if(s.cancelled)return;
      s.frames=0;s.phase='priming';invalidate();
    }).catch(error=>{linear.dispose();compilation.release();if(!s.cancelled){s.phase='failed';callbacks.current.onError();console.error(error);}});
  },-20);
  return ready;
}
