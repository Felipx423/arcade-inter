import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { transmissionRegion } from '../src/transmission.ts';
test('pré-passe mantém resolução e cobre cápsula, espessura e margem dos mipmaps', () => {
  const scene = new THREE.Scene(); const camera = new THREE.PerspectiveCamera(42, 16/9, .1, 50); camera.position.z=8; camera.updateMatrixWorld();
  const m = new THREE.MeshPhysicalMaterial({transmission:.5, thickness:.04, roughness:.1}); m.userData.pegaCapsule=true;
  const ball = new THREE.Mesh(new THREE.SphereGeometry(.25), m); scene.add(ball); scene.updateMatrixWorld(true);
  const region = transmissionRegion(scene,camera,1600,900);
  assert.ok(region.z < 700 && region.w < 500); assert.ok(region.x <= 800-64 && region.y <= 450-64);
  assert.ok(region.x+region.z >= 800+64 && region.y+region.w >= 450+64);
  m.roughness = .9; assert.deepEqual(transmissionRegion(scene,camera,1600,900).toArray(),[0,0,1600,900]);
});
test('shader desconhecido, proximidade da câmera ou mapas de rugosidade usam pré-passe completo', () => {
  const scene=new THREE.Scene(), camera=new THREE.PerspectiveCamera(42,1,.1,50); camera.position.z=.1; camera.updateMatrixWorld();
  const material=new THREE.MeshPhysicalMaterial({transmission:.5}); const mesh=new THREE.Mesh(new THREE.SphereGeometry(.25),material); scene.add(mesh); scene.updateMatrixWorld(true);
  assert.deepEqual(transmissionRegion(scene,camera,256,256).toArray(),[0,0,256,256]);
  material.userData.pegaCapsule=true; assert.deepEqual(transmissionRegion(scene,camera,256,256).toArray(),[0,0,256,256]);
});
