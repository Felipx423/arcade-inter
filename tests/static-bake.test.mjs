import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createBakeMaterial,cachedShadowFunctions } from '../src/static-bake.ts';

test('cache separa contribuição direcional e verniz, mantendo coordenadas de sombra em alta precisão',()=>{
  const original=new THREE.MeshPhysicalMaterial({clearcoat:.14,map:new THREE.Texture()});
  const material=createBakeMaterial(original,true);
  const shader={fragmentShader:THREE.ShaderLib.physical.fragmentShader};material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader,/pegaCoatDirectional\*material.clearcoat/);
  assert.match(shader.fragmentShader,/pegaCoord-pegaHigh/);
  assert.match(shader.fragmentShader,/layout\(location=3\)/);
  assert.equal(material.map,original.map);assert.equal(material.clearcoat,.14);
  assert.match(cachedShadowFunctions,/float getShadow/);assert.match(cachedShadowFunctions,/vogelDiskSample\( 4, 5, phi \)/);
  assert.ok(!cachedShadowFunctions.includes('#if'));
});
