import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { batchStaticMeshes } from '../src/batching.ts';

test('lote preserva vértices, normais, UVs, material e sombras com transforms aninhados', () => {
  const root = new THREE.Group(); root.position.set(4, 2, -3);
  const nested = new THREE.Group(); nested.position.set(1, 2, 3); nested.scale.set(1, 1.1, .8); root.add(nested);
  const material = () => new THREE.MeshPhysicalMaterial({ color: '#fff8e1', roughness: .46, clearcoat: .14 });
  for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(.3, .4, .5), material()); m.position.x = i; m.castShadow = m.receiveShadow = true; nested.add(m); }
  root.updateWorldMatrix(true, true);
  const before = nested.children.map(m => new THREE.Vector3().fromBufferAttribute(m.geometry.getAttribute('position'), 0).applyMatrix4(m.matrixWorld));
  const batch = batchStaticMeshes(root);
  assert.equal(batch.meshes.length, 1);
  const mesh = batch.meshes[0]; root.updateWorldMatrix(true, true);
  assert.equal(mesh.geometry.getAttribute('position').count, 24 * 4);
  assert.equal(mesh.geometry.getAttribute('uv').count, 24 * 4);
  assert.equal(mesh.castShadow, true); assert.equal(mesh.receiveShadow, true);
  for (let i = 0; i < 4; i++) assert.ok(before[i].distanceTo(new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 24 * i).applyMatrix4(mesh.matrixWorld)) < .00001);
  assert.ok(nested.children.every(m => !m.visible));
  batch.dispose(); assert.ok(nested.children.every(m => m.visible)); assert.equal(root.children.length, 1);
});
test('não agrupa vidro, transmissão, materiais customizados ou sombras diferentes', () => {
  const root = new THREE.Group();
  for (const options of [{transparent:true}, {transmission:.5}, {}, {}]) root.add(new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshPhysicalMaterial(options)));
  root.children[3].castShadow = true;
  const batch = batchStaticMeshes(root); assert.equal(batch.meshes.length, 0); assert.ok(root.children.every(m=>m.visible)); batch.dispose();
});

test('cores lineares diferentes compartilham lote sem alterar mapas ou resposta do material',()=>{
  const root=new THREE.Group(),map=new THREE.Texture();
  const sources=['#56D867','#FFF8E1','#001D89'].map(color=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshPhysicalMaterial({color,map,roughness:.46,metalness:.14,clearcoat:.14}));root.add(mesh);return mesh;});
  const batch=batchStaticMeshes(root);assert.equal(batch.meshes.length,1);
  const merged=batch.meshes[0],color=new THREE.Color();assert.equal(merged.material.map,map);assert.equal(merged.material.roughness,.46);assert.equal(merged.material.clearcoat,.14);
  for(let source=0;source<3;source++)for(let vertex=0;vertex<24;vertex++){
    color.fromBufferAttribute(merged.geometry.getAttribute('color'),source*24+vertex).multiply(merged.material.color);
    assert.ok(Math.abs(color.r-sources[source].material.color.r)<1e-6 && Math.abs(color.g-sources[source].material.color.g)<1e-6 && Math.abs(color.b-sources[source].material.color.b)<1e-6);
  }
  batch.dispose();assert.ok(sources.every(s=>s.visible));assert.ok(map.isTexture);
});
