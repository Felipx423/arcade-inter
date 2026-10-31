import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { pointLightMask, specializePointLights } from '../src/light-culling.ts';

test('elimina apenas luzes cujo raio não alcança o volume inteiro do objeto', () => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2));
  mesh.updateMatrixWorld();
  const near = new THREE.PointLight('white', 2, 1); near.position.set(1.9,0,0);
  const far = new THREE.PointLight('white', 2, 1); far.position.set(2.1,0,0);
  const infinite = new THREE.PointLight('white', 2, 0); infinite.position.set(100,0,0);
  for (const light of [near,far,infinite]) light.updateMatrixWorld();
  assert.equal(pointLightMask(mesh,[near,far,infinite]),5);
  mesh.scale.x=2; mesh.updateMatrixWorld();
  assert.equal(pointLightMask(mesh,[near,far,infinite]),7);
});

test('especialização mantém shader padrão para todos os índices ativos', () => {
  const material = new THREE.MeshPhysicalMaterial(); specializePointLights(material,5,3);
  const shader={fragmentShader:'#include <lights_fragment_begin>'};
  material.onBeforeCompile(shader,{});
  assert.match(shader.fragmentShader, /PEGA_POINT_MASK/);
  assert.match(shader.fragmentShader, /NUM_POINT_LIGHTS != 3/);
  assert.match(shader.fragmentShader, /getPointLightInfo/);
  assert.ok(material.customProgramCacheKey().includes('5:3'));
});
