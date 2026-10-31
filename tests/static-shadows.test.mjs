import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {installStaticShadows,staticShadowMetrics} from '../src/static-shadows.ts';

test('sombra fixa e móvel mantêm profundidade nativa e ignoram cenas auxiliares',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group();root.userData.staticArcade=true;scene.add(root);
  const fixedMesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());fixedMesh.castShadow=true;root.add(fixedMesh);
  const moving=new THREE.Mesh(fixedMesh.geometry,fixedMesh.material);moving.castShadow=true;scene.add(moving);
  const light=new THREE.DirectionalLight();light.castShadow=true;scene.add(light);scene.updateMatrixWorld();
  const draws=[],copies=[];let target=null;
  const renderer={shadowMap:{type:THREE.PCFShadowMap,enabled:true,autoUpdate:true,needsUpdate:false,render(lights,world){
    if(world!==scene || !lights.includes(light))return;
    if(!light.shadow.map){light.shadow.map=new THREE.WebGLRenderTarget(512,512);light.shadow.map.depthTexture=new THREE.DepthTexture(512,512,THREE.UnsignedIntType);light.shadow.map.depthTexture.compareFunction=THREE.LessEqualCompare;}
    target=light.shadow.map;renderer.clear();draws.push([fixedMesh.castShadow,moving.castShadow]);
  }},clear(){},getRenderTarget(){return target;},setRenderTarget(t){target=t;},copyTextureToTexture(a,b){copies.push([a,b]);},initRenderTarget(){}};
  const originalRender=renderer.shadowMap.render,originalClear=renderer.clear;
  const dispose=installStaticShadows(renderer,scene);
  renderer.shadowMap.render([],new THREE.Scene(),new THREE.Camera());assert.equal(draws.length,0);
  renderer.shadowMap.render([light],scene,new THREE.Camera());assert.deepEqual(draws,[[true,false],[false,true]]);
  assert.equal(copies[0][0].type,THREE.UnsignedIntType);assert.equal(copies[0][1].compareFunction,THREE.LessEqualCompare);
  const builds=staticShadowMetrics.builds;moving.position.x=1;scene.updateMatrixWorld();renderer.shadowMap.render([light],scene,new THREE.Camera());
  assert.equal(staticShadowMetrics.builds,builds);assert.deepEqual(draws.at(-1),[false,true]);
  fixedMesh.position.y=1;scene.updateMatrixWorld();renderer.shadowMap.render([light],scene,new THREE.Camera());assert.equal(staticShadowMetrics.builds,builds+1);
  assert.ok(fixedMesh.castShadow && moving.castShadow);dispose();assert.equal(renderer.shadowMap.render,originalRender);assert.equal(renderer.clear,originalClear);
});
