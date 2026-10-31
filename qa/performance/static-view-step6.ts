import * as THREE from 'three';

const CACHE_LAYER=1;
export const staticViewMetrics={builds:0,hits:0,shadowInvalidations:0,meshes:0,bytes:0};

/** Exact interval test for an AABB swept along a directional-light ray. */
export function shadowCanReach(caster:THREE.Box3,receiver:THREE.Box3,direction:THREE.Vector3){
  let enter=0,exit=Infinity;
  for(const axis of ['x','y','z'] as const){
    const d=direction[axis];
    if(Math.abs(d)<1e-10){if(caster.max[axis]<receiver.min[axis] || caster.min[axis]>receiver.max[axis])return false;continue;}
    const a=(receiver.min[axis]-caster.max[axis])/d,b=(receiver.max[axis]-caster.min[axis])/d;
    enter=Math.max(enter,Math.min(a,b));exit=Math.min(exit,Math.max(a,b));
    if(enter>exit)return false;
  }
  return exit>=0;
}

type Entry={target:THREE.WebGLRenderTarget;signature:string};
export function installStaticViews(gl:THREE.WebGLRenderer,scene:THREE.Scene){
  if(!gl.extensions.has('EXT_color_buffer_float'))return ()=>{};
  const roots:THREE.Object3D[]=[],meshes:THREE.Mesh[]=[],casters:THREE.Mesh[]=[],lights:THREE.Light[]=[];
  scene.traverse(o=>{if(o.userData.staticArcade)roots.push(o);if(o instanceof THREE.Light)lights.push(o);});
  for(const root of roots)root.traverseVisible(o=>{
    if(!(o instanceof THREE.Mesh) || Array.isArray(o.material))return;
    const m=o.material as THREE.MeshPhysicalMaterial;
    if(!(m instanceof THREE.MeshStandardMaterial) || m.transparent || m.transmission>0 || !m.toneMapped || !m.fog)return;
    meshes.push(o);
  });
  if(!meshes.length)return ()=>{};
  const originalLayers=new Map(meshes.map(m=>[m,m.layers.mask]));
  const lightLayers=new Map(lights.map(l=>[l,l.layers.mask]));
  const shadowLights=lights.filter((l):l is THREE.DirectionalLight=>l instanceof THREE.DirectionalLight && l.castShadow);
  // Other shadow types need a different conservative influence test.
  if(lights.some(l=>l.castShadow && !(l instanceof THREE.DirectionalLight)))return ()=>{};
  const shadowLayers=new Map(shadowLights.map(l=>[l,l.shadow.camera.layers.mask]));
  meshes.forEach(m=>m.layers.enable(CACHE_LAYER));lights.forEach(l=>l.layers.enable(CACHE_LAYER));
  shadowLights.forEach(l=>l.shadow.camera.layers.enable(CACHE_LAYER));
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh) || !o.castShadow)return;
    let parent:THREE.Object3D|null=o;
    while(parent && !parent.userData.staticScenery && !parent.userData.staticArcade)parent=parent.parent;
    if(!parent)casters.push(o);
  });
  scene.updateMatrixWorld(true);
  const receiverBounds=meshes.map(m=>{
    if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();
    return m.geometry.boundingBox!.clone().applyMatrix4(m.matrixWorld);
  });
  const entries=new Map<THREE.Camera,Entry>();
  const box=new THREE.Box3(),direction=new THREE.Vector3(),targetPosition=new THREE.Vector3();
  const material=new THREE.ShaderMaterial({
    uniforms:{cacheColor:{value:null},cacheDepth:{value:null},inverseProjection:{value:new THREE.Matrix4()},fogColor:{value:new THREE.Color()},fogRange:{value:new THREE.Vector2(11,28)}},
    vertexShader:`varying vec2 cacheUV; void main(){ cacheUV=uv;gl_Position=vec4(position.xy,0.0,1.0); }`,
    fragmentShader:`
      uniform sampler2D cacheColor,cacheDepth;
      uniform mat4 inverseProjection;
      uniform vec3 fogColor;
      uniform vec2 fogRange;
      varying vec2 cacheUV;
      void main(){
        vec4 sampleColor=texture2D(cacheColor,cacheUV);
        if(sampleColor.a<0.00001)discard;
        float depth=texture2D(cacheDepth,cacheUV).r;
        gl_FragDepth=depth;
        gl_FragColor=vec4(sampleColor.rgb/sampleColor.a,sampleColor.a);
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
  composite.frustumCulled=false;composite.renderOrder=100;composite.visible=false;scene.add(composite);
  composite.userData.warmShader=true;
  composite.onBeforeRender=(_renderer,_scene,camera)=>{
    const entry=entries.get(camera);if(!entry)return;
    material.uniforms.cacheColor.value=entry.target.texture;material.uniforms.cacheDepth.value=entry.target.depthTexture;
    material.uniforms.inverseProjection.value.copy(camera.projectionMatrix).invert();
    const fog=scene.fog as THREE.Fog|null;
    if(fog){material.uniforms.fogColor.value.copy(fog.color);material.uniforms.fogRange.value.set(fog.near,fog.far);}
    else material.uniforms.fogRange.value.set(1e8,1e9);
    material.uniformsNeedUpdate=true;
  };
  const render=gl.render;let building=false;
  staticViewMetrics.meshes=meshes.length;
  function shadowDirty(){
    for(const light of shadowLights){
      light.getWorldPosition(direction);light.target.getWorldPosition(targetPosition);direction.subVectors(targetPosition,direction).normalize();
      for(const caster of casters){
        let visible=true;for(let p:THREE.Object3D|null=caster;p;p=p.parent)if(!p.visible){visible=false;break;}
        if(!visible)continue;
        if(!caster.geometry.boundingBox)caster.geometry.computeBoundingBox();
        box.copy(caster.geometry.boundingBox!).applyMatrix4(caster.matrixWorld).expandByScalar(.03);
        for(const receiver of receiverBounds)if(shadowCanReach(box,receiver,direction))return true;
      }
    }
    return false;
  }
  gl.render=function(s,camera){
    if(s!==scene || building || shadowLights.some(l=>!l.shadow.map))return render.call(gl,s,camera);
    const previous=gl.getRenderTarget(),width=previous?.width??gl.domElement.width,height=previous?.height??gl.domElement.height;
    const signature=[width,height,...camera.matrixWorld.elements,...camera.projectionMatrix.elements,scene.environment?.uuid,scene.environment?.version].join(',');
    let entry=entries.get(camera);
    const dirty=shadowDirty();if(dirty)staticViewMetrics.shadowInvalidations++;
    if(!entry || entry.signature!==signature || dirty){
      entry?.target.dispose();
      const target=new THREE.WebGLRenderTarget(width,height,{type:THREE.HalfFloatType,minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,samples:Math.min(4,gl.capabilities.maxSamples)});
      target.depthTexture=new THREE.DepthTexture(width,height,THREE.UnsignedIntType);
      const cacheCamera=camera.clone();cacheCamera.layers.set(CACHE_LAYER);
      cacheCamera.projectionMatrix.copy(camera.projectionMatrix);cacheCamera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
      const background=scene.background,fog=scene.fog,autoShadow=gl.shadowMap.autoUpdate,autoClear=gl.autoClear;
      const clearColor=gl.getClearColor(new THREE.Color()),clearAlpha=gl.getClearAlpha();
      try{
        building=true;scene.background=null;scene.fog=null;gl.shadowMap.autoUpdate=false;gl.autoClear=true;gl.setClearColor(0,0);
        gl.setRenderTarget(target);render.call(gl,scene,cacheCamera);
      }finally{
        gl.setRenderTarget(previous);gl.setClearColor(clearColor,clearAlpha);gl.autoClear=autoClear;gl.shadowMap.autoUpdate=autoShadow;scene.background=background;scene.fog=fog;building=false;
      }
      entry={target,signature};entries.set(camera,entry);staticViewMetrics.builds++;
      staticViewMetrics.bytes=[...entries.values()].reduce((n,e)=>n+e.target.width*e.target.height*12,0);
    }else staticViewMetrics.hits++;
    for(const mesh of meshes)mesh.layers.disable(0);
    composite.visible=true;
    try{return render.call(gl,s,camera);}finally{composite.visible=false;for(const mesh of meshes)mesh.layers.enable(0);}
  };
  return ()=>{
    gl.render=render;scene.remove(composite);geometry.dispose();material.dispose();
    for(const entry of entries.values())entry.target.dispose();
    for(const [mesh,mask]of originalLayers)mesh.layers.mask=mask;
    for(const [light,mask]of lightLayers)light.layers.mask=mask;
    for(const [light,mask]of shadowLayers)light.shadow.camera.layers.mask=mask;
  };
}
