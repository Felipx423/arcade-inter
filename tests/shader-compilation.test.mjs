import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {compilationView} from '../src/shader-compilation.ts';

test('pré-compilação preserva meshes reais, variantes instanciadas e propriedade dos recursos',()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group();scene.add(parent);
  const geometry=new THREE.BoxGeometry(),material=new THREE.MeshStandardMaterial();
  const instance=new THREE.InstancedMesh(geometry,material,2),batch=new THREE.BatchedMesh(2,24,36,material);
  const hidden=new THREE.Mesh(geometry,material);hidden.visible=false;
  const warm=new THREE.Mesh(geometry,material);warm.visible=false;warm.userData.warmShader=true;
  parent.add(instance,batch,hidden,warm);
  const compilation=compilationView(scene),collected=new Set();compilation.view.traverse(o=>collected.add(o));
  assert.ok(collected.has(instance) && collected.has(batch) && collected.has(warm));assert.ok(!collected.has(hidden));
  assert.equal(instance.parent,parent);assert.equal(batch.material,material);assert.equal(instance.geometry,geometry);
  let disposed=0;geometry.addEventListener('dispose',()=>disposed++);material.addEventListener('dispose',()=>disposed++);
  compilation.release();assert.equal(compilation.view.children.length,0);assert.equal(instance.parent,parent);assert.equal(warm.parent,parent);assert.equal(parent.children.length,4);assert.equal(disposed,0);
  batch.dispose();geometry.dispose();material.dispose();
});
