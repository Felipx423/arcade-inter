import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createAnimatedBatches} from '../src/animated-batching.ts';

const closeMatrix=(actual,expected)=>actual.elements.forEach((value,i)=>assert.ok(Math.abs(value-expected.elements[i])<1e-6,`componente ${i} difere além da precisão float32`));
const closeColor=(actual,expected)=>['r','g','b'].forEach(key=>assert.ok(Math.abs(actual[key]-expected[key])<1e-6));

test('lotes móveis preservam transforms, cores, sombras, visibilidade e alvos de interação',()=>{
  const scene=new THREE.Scene(),parent=new THREE.Group();parent.position.set(1,2,3);parent.scale.set(1,.8,1.2);scene.add(parent);
  const sources=['#56D867','#001D89'].map((color,i)=>{
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(.25,32,20),new THREE.MeshPhysicalMaterial({color,clearcoat:1,roughness:.16,metalness:.12}));
    mesh.position.x=i;mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  });
  const batch=createAnimatedBatches(scene);assert.equal(batch.batches.length,1);
  const mesh=batch.batches[0],matrix=new THREE.Matrix4(),color=new THREE.Color();
  assert.ok(mesh.castShadow && mesh.receiveShadow);
  for(let i=0;i<2;i++){mesh.getMatrixAt(i,matrix);closeMatrix(matrix,sources[i].matrixWorld);mesh.getColorAt(i,color);closeColor(color,sources[i].material.color);}
  parent.position.x=4;parent.rotation.y=.7;batch.update();mesh.getMatrixAt(1,matrix);closeMatrix(matrix,sources[1].matrixWorld);
  parent.visible=false;batch.update();assert.equal(mesh.getVisibleAt(0),false);
  parent.visible=true;batch.update();assert.equal(mesh.getVisibleAt(0),true);
  const position=sources[0].getWorldPosition(new THREE.Vector3());
  const ray=new THREE.Raycaster(position.clone().add(new THREE.Vector3(0,0,2)),new THREE.Vector3(0,0,-1));
  assert.ok(ray.intersectObject(sources[0]).length>0,'geometria original continua disponível ao raycast');
  batch.dispose();assert.ok(sources.every(s=>s.visible));assert.equal(scene.children.length,1);
});

test('lotes móveis mantêm vidro e objetos com material variável separados',()=>{
  const scene=new THREE.Scene();
  for(const options of [{transparent:true,opacity:.2},{transmission:.5},{transparent:true,opacity:.2}])scene.add(new THREE.Mesh(new THREE.SphereGeometry(),new THREE.MeshPhysicalMaterial(options)));
  const individual=new THREE.Group();individual.userData.individualDraw=true;scene.add(individual);
  for(let i=0;i<2;i++)individual.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));
  const batches=createAnimatedBatches(scene);assert.equal(batches.batches.length,0);batches.dispose();
});
