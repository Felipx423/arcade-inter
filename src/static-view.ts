import * as THREE from 'three';
import { createBakeMaterial,cachedShadowFunctions } from './static-bake.ts';
import {isOccluded,readDepthGrid,type DepthGrid} from './occlusion.ts';

const CACHE_LAYER=1;
export const staticViewMetrics={builds:0,hits:0,shadowInvalidations:0,meshes:0,bytes:0,occluded:0,depthGrids:0,depthRanges:[] as {minimum:number;covered:number;pixels:number}[]};

export function shadowCanReach(caster:THREE.Box3,receiver:THREE.Box3,direction:THREE.Vector3){
  let enter=0,exit=Infinity;
  for(const axis of ['x','y','z'] as const){
    const d=direction[axis];
    if(Math.abs(d)<1e-10){if(caster.max[axis]<receiver.min[axis] || caster.min[axis]>receiver.max[axis])return false;continue;}
    const a=(receiver.min[axis]-caster.max[axis])/d,b=(receiver.max[axis]-caster.min[axis])/d;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));if(enter>exit)return false;
  }
  return exit>=0;
}

type Entry={target:THREE.WebGLRenderTarget;signature:string;grid?:DepthGrid};
export function installStaticViews(gl:THREE.WebGLRenderer,scene:THREE.Scene,invalidate:()=>void=()=>{}){
  if(new URLSearchParams(location.search).has('noStaticCache'))return ()=>{};
  const context=gl.getContext() as WebGL2RenderingContext;
  if(!gl.extensions.has('EXT_color_buffer_float') || context.getParameter(context.MAX_DRAW_BUFFERS)<4)return ()=>{};
  const roots:THREE.Object3D[]=[],meshSet=new Set<THREE.Mesh>(),lights:THREE.Light[]=[];
  scene.traverse(o=>{if(o.userData.staticArcade)roots.push(o);if(o instanceof THREE.Light)lights.push(o);});
  for(const root of roots)root.traverseVisible(o=>{
    if(!(o instanceof THREE.Mesh) || Array.isArray(o.material))return;
    const m=o.material as THREE.MeshPhysicalMaterial;
    if(![THREE.MeshStandardMaterial,THREE.MeshPhysicalMaterial].includes(m.constructor as typeof THREE.MeshPhysicalMaterial) || m.transparent || m.transmission>0 || m.sheen>0 || !m.toneMapped || !m.fog)return;
    meshSet.add(o);
  });
  const meshes=[...meshSet];if(!meshes.length)return ()=>{};
  const hiddenDynamic:THREE.Mesh[]=[];
  const shadowLights=lights.filter((l):l is THREE.DirectionalLight=>l instanceof THREE.DirectionalLight && l.castShadow);
  if(shadowLights.length!==1 || lights.some(l=>l.castShadow && !(l instanceof THREE.DirectionalLight)) || gl.shadowMap.type!==THREE.PCFShadowMap)return ()=>{};
  const shadowLight=shadowLights[0];
  const originalLayers=new Map(meshes.map(m=>[m,m.layers.mask]));
  const shadowMap=gl.shadowMap as THREE.WebGLShadowMap & {render:(...args:unknown[])=>void};
  const renderShadow=shadowMap.render;
  shadowMap.render=function(...args){
    if(args[1]!==scene || !shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate))return renderShadow.apply(shadowMap,args);
    const masks=meshes.map(m=>m.layers.mask);
    meshes.forEach(m=>m.layers.enable(0));
    hiddenDynamic.forEach(m=>m.visible=true);
    try{return renderShadow.apply(shadowMap,args);}finally{meshes.forEach((m,i)=>m.layers.mask=masks[i]);hiddenDynamic.forEach(m=>m.visible=false);}
  };
  const lightLayers=new Map(lights.map(l=>[l,l.layers.mask]));
  const shadowLayer=shadowLight.shadow.camera.layers.mask;
  meshes.forEach(m=>m.layers.enable(CACHE_LAYER));lights.forEach(l=>l.layers.enable(CACHE_LAYER));shadowLight.shadow.camera.layers.enable(CACHE_LAYER);
  const entries=new Map<THREE.Camera,Entry>();
  const bakeMaterials=new Map<string,THREE.MeshStandardMaterial>();
  const originals=new Map<THREE.Mesh,THREE.Material>(),baked=new Map<THREE.Mesh,THREE.MeshStandardMaterial>();
  const warmObjects=new THREE.Group();warmObjects.visible=false;scene.add(warmObjects);
  for(const mesh of meshes){
    const original=mesh.material as THREE.MeshStandardMaterial,key=`${original.uuid}:${mesh.receiveShadow}`;
    let bake=bakeMaterials.get(key);if(!bake){bake=createBakeMaterial(original,mesh.receiveShadow);bakeMaterials.set(key,bake);}
    originals.set(mesh,original);baked.set(mesh,bake);
    const warm=new THREE.Mesh(mesh.geometry,bake);warm.receiveShadow=mesh.receiveShadow;warm.userData.warmShader=true;warmObjects.add(warm);
  }
  const material=new THREE.ShaderMaterial({
    uniforms:{cacheColor:{value:null},cacheDirect:{value:null},cacheHigh:{value:null},cacheLow:{value:null},cacheDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},fogColor:{value:new THREE.Color()},fogRange:{value:new THREE.Vector2(11,28)},cachedShadowMap:{value:null},shadowSize:{value:new THREE.Vector2()},shadowParameters:{value:new THREE.Vector3()}},
    vertexShader:`varying vec2 cacheUV; void main(){cacheUV=uv;gl_Position=vec4(position.xy,0.0,1.0);}`,
    fragmentShader:`
      #include <common>
      uniform sampler2D cacheColor,cacheDirect,cacheHigh,cacheLow,cacheDepth;
      uniform highp sampler2DShadow cachedShadowMap;
      uniform mat4 inverseProjection;
      uniform vec3 fogColor,shadowParameters;
      uniform vec2 fogRange,shadowSize;
      varying vec2 cacheUV;
      ${cachedShadowFunctions}
      void main(){
        vec4 sampleColor=texture2D(cacheColor,cacheUV);
        if(sampleColor.a<0.00001)discard;
        float coverage=sampleColor.a;
        float depth=texture2D(cacheDepth,cacheUV).r;
        gl_FragDepth=depth;
        vec3 shadowCoord=(texture2D(cacheHigh,cacheUV).rgb+texture2D(cacheLow,cacheUV).rgb)/coverage;
        float shadow=getShadow(cachedShadowMap,shadowSize,shadowParameters.x,shadowParameters.y,shadowParameters.z,vec4(shadowCoord,1.0));
        vec3 color=(sampleColor.rgb+texture2D(cacheDirect,cacheUV).rgb*(shadow-1.0))/coverage;
        gl_FragColor=vec4(max(color,vec3(0.0)),coverage);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        vec4 viewPosition=inverseProjection*vec4(cacheUV*2.0-1.0,depth*2.0-1.0,1.0);
        float fogDepth=-viewPosition.z/viewPosition.w;
        gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor,smoothstep(fogRange.x,fogRange.y,fogDepth));
      }`,
    depthWrite:true,depthTest:true,transparent:false,
    blending:THREE.CustomBlending,blendSrc:THREE.SrcAlphaFactor,blendDst:THREE.OneMinusSrcAlphaFactor,blendEquation:THREE.AddEquation,
  });
  const geometry=new THREE.PlaneGeometry(2,2),composite=new THREE.Mesh(geometry,material);
  composite.frustumCulled=false;composite.renderOrder=-10000;composite.visible=false;composite.userData.warmShader=true;scene.add(composite);
  composite.onBeforeRender=(_renderer,_scene,camera)=>{
    const entry=entries.get(camera);if(!entry)return;
    material.uniforms.cacheColor.value=entry.target.textures[0];material.uniforms.cacheDirect.value=entry.target.textures[1];
    material.uniforms.cacheHigh.value=entry.target.textures[2];material.uniforms.cacheLow.value=entry.target.textures[3];material.uniforms.cacheDepth.value=entry.target.depthTexture;
    material.uniforms.inverseProjection.value.copy(camera.projectionMatrix).invert();
    const fog=scene.fog as THREE.Fog|null;
    if(fog){material.uniforms.fogColor.value.copy(fog.color);material.uniforms.fogRange.value.set(fog.near,fog.far);}else material.uniforms.fogRange.value.set(1e8,1e9);
    const shadow=shadowLight.shadow;
    material.uniforms.cachedShadowMap.value=shadow.map!.depthTexture??shadow.map!.texture;
    material.uniforms.shadowSize.value.copy(shadow.mapSize);material.uniforms.shadowParameters.value.set(shadow.intensity,shadow.bias,shadow.radius);
    material.uniformsNeedUpdate=true;
  };
  const render=gl.render;let building=false,disposed=false;
  staticViewMetrics.meshes=meshes.length;
  gl.render=function(s,camera){
    if(s!==scene || building || !shadowLight.shadow.map)return render.call(gl,s,camera);
    const previous=gl.getRenderTarget(),width=previous?.width??gl.domElement.width,height=previous?.height??gl.domElement.height;
    const signature=[width,height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,scene.environment?.uuid,scene.environment?.version].join(',');
    let entry=entries.get(camera);
    if(!entry || entry.signature!==signature){
      entry?.target.dispose();
      const target=new THREE.WebGLRenderTarget(width,height,{count:4,type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,samples:Math.min(4,gl.capabilities.maxSamples)});
      target.depthTexture=new THREE.DepthTexture(width,height,THREE.UnsignedIntType);
      const cacheCamera=camera.clone();cacheCamera.layers.set(CACHE_LAYER);cacheCamera.projectionMatrix.copy(camera.projectionMatrix);cacheCamera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const background=scene.background,fog=scene.fog,autoShadow=gl.shadowMap.autoUpdate,autoClear=gl.autoClear;
      const clearColor=gl.getClearColor(new THREE.Color()),clearAlpha=gl.getClearAlpha();
      try{
        building=true;scene.background=null;scene.fog=null;gl.shadowMap.autoUpdate=false;gl.autoClear=true;gl.setClearColor(0,0);
        for(const mesh of meshes)mesh.material=baked.get(mesh)!;
        gl.setRenderTarget(target);render.call(gl,scene,cacheCamera);
      }finally{
        for(const mesh of meshes)mesh.material=originals.get(mesh)!;
        gl.setRenderTarget(previous);gl.setClearColor(clearColor,clearAlpha);gl.autoClear=autoClear;gl.shadowMap.autoUpdate=autoShadow;scene.background=background;scene.fog=fog;building=false;
      }
      entry={target,signature};entries.set(camera,entry);staticViewMetrics.builds++;
      staticViewMetrics.bytes=[...entries.values()].reduce((n,e)=>n+e.target.width*e.target.height*36,0);
      const saved=entry;
      void readDepthGrid(gl,target).then(grid=>{if(!disposed && entries.get(camera)===saved){saved.grid=grid;staticViewMetrics.depthGrids++;let minimum=1,covered=0;for(let i=0;i<grid.pixels.length;i+=4){const d=(grid.pixels[i]*65536+grid.pixels[i+1]*256+grid.pixels[i+2])/16777215;minimum=Math.min(d,minimum);if(d<1)covered++;}staticViewMetrics.depthRanges.push({minimum,covered,pixels:grid.width*grid.height});if(staticViewMetrics.depthRanges.length>6)staticViewMetrics.depthRanges.shift();invalidate();}}).catch(()=>{});
    }else staticViewMetrics.hits++;
    if(entry.grid){
      scene.updateMatrixWorld();
      scene.traverseVisible(o=>{if(o instanceof THREE.Mesh && !meshSet.has(o) && o!==composite && !(o instanceof THREE.InstancedMesh) && !(o instanceof THREE.BatchedMesh) && !Array.isArray(o.material) && isOccluded(o,camera,entry!.grid!)){hiddenDynamic.push(o);o.visible=false;staticViewMetrics.occluded++;}});
    }
    for(const mesh of meshes)mesh.layers.disable(0);composite.visible=true;
    try{return render.call(gl,s,camera);}finally{composite.visible=false;for(const mesh of meshes)mesh.layers.enable(0);hiddenDynamic.forEach(m=>m.visible=true);hiddenDynamic.length=0;}
  };
  return ()=>{
    disposed=true;gl.render=render;shadowMap.render=renderShadow;scene.remove(composite,warmObjects);geometry.dispose();material.dispose();for(const m of bakeMaterials.values())m.dispose();for(const entry of entries.values())entry.target.dispose();
    for(const [mesh,mask]of originalLayers)mesh.layers.mask=mask;for(const [light,mask]of lightLayers)light.layers.mask=mask;shadowLight.shadow.camera.layers.mask=shadowLayer;
  };
}
