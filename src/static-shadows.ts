import * as THREE from 'three';

export const staticShadowMetrics={builds:0,copies:0,casters:0};

/** Preserve native depth/filtering; copy fixed casters' depth before drawing moving casters. */
export function installStaticShadows(renderer:THREE.WebGLRenderer,scene:THREE.Scene){
  if(typeof location!=='undefined' && !new URLSearchParams(location.search).has('shadowCache'))return ()=>{};
  const casters=new Set<THREE.Mesh>(),lights:THREE.DirectionalLight[]=[];
  scene.traverse(o=>{
    if(o.userData.staticArcade)o.traverseVisible(child=>{if(child instanceof THREE.Mesh && child.castShadow)casters.add(child);});
    if(o instanceof THREE.DirectionalLight && o.castShadow)lights.push(o);
  });
  if(lights.length!==1 || renderer.shadowMap.type!==THREE.PCFShadowMap || !casters.size)return ()=>{};
  const light=lights[0],shadow=light.shadow;
  const shadowMap=renderer.shadowMap as THREE.WebGLShadowMap & {render:(...args:unknown[])=>void};
  const render=shadowMap.render,clear=renderer.clear;
  let fixed:THREE.WebGLRenderTarget|null=null,combined:THREE.WebGLRenderTarget|null=null,signature='',copy=false;
  staticShadowMetrics.casters=casters.size;
  renderer.clear=function(...args){
    clear.apply(renderer,args);
    if(copy && fixed?.depthTexture && combined?.depthTexture && renderer.getRenderTarget()===combined){
      renderer.copyTextureToTexture(fixed.depthTexture,combined.depthTexture);
      renderer.setRenderTarget(combined);
      staticShadowMetrics.copies++;
    }
  };
  shadowMap.render=function(...args){
    if(args[1]!==scene || !(args[0] as THREE.Light[]).includes(light) || !shadowMap.enabled || (!shadowMap.autoUpdate && !shadowMap.needsUpdate))return render.apply(shadowMap,args);
    const key=[shadow.mapSize.x,shadow.mapSize.y,...light.matrixWorld.elements,...light.target.matrixWorld.elements,...shadow.camera.projectionMatrix.elements,...[...casters].flatMap(m=>[m.visible,...m.matrixWorld.elements])].join(',');
    const changes:{mesh:THREE.Mesh;cast:boolean}[]=[];
    if(!fixed || key!==signature){
      scene.traverse(o=>{if(o instanceof THREE.Mesh && o.castShadow && !casters.has(o)){changes.push({mesh:o,cast:true});o.castShadow=false;}});
      const oldFixed=fixed;
      try{
        shadow.map=fixed;shadow.needsUpdate=true;shadowMap.needsUpdate=true;
        render.apply(shadowMap,args);
        fixed=shadow.map as THREE.WebGLRenderTarget;
        if(oldFixed && fixed!==oldFixed)oldFixed.dispose();
        combined?.dispose();combined=fixed.clone();renderer.initRenderTarget(combined);
        signature=key;staticShadowMetrics.builds++;
      }finally{changes.forEach(({mesh,cast})=>mesh.castShadow=cast);changes.length=0;}
    }
    for(const mesh of casters){changes.push({mesh,cast:mesh.castShadow});mesh.castShadow=false;}
    shadow.map=combined;shadow.needsUpdate=true;shadowMap.needsUpdate=true;copy=true;
    try{return render.apply(shadowMap,args);}finally{copy=false;changes.forEach(({mesh,cast})=>mesh.castShadow=cast);}
  };
  return ()=>{renderer.clear=clear;shadowMap.render=render;combined?.dispose();shadow.map=fixed;};
}
