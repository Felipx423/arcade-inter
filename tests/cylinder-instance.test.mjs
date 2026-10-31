import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

test('cilindro compartilhado mantém a mesma tesselação, posições, normais e UVs das peças originais',()=>{
  const unit=new THREE.CylinderGeometry(1,1,1,24),point=new THREE.Vector3(),original=new THREE.Vector3();
  for(const [radius,height] of [[.019,.009],[.04,.23],[.17,.09],[.11,.3]]){
    const geometry=new THREE.CylinderGeometry(radius,radius,height,24);
    const matrix=new THREE.Matrix4().makeScale(radius,height,radius),normalMatrix=new THREE.Matrix3().getNormalMatrix(matrix);
    assert.deepEqual([...unit.index.array],[...geometry.index.array]);
    assert.deepEqual([...unit.attributes.uv.array],[...geometry.attributes.uv.array]);
    for(let i=0;i<unit.attributes.position.count;i++){
      point.fromBufferAttribute(unit.attributes.position,i).applyMatrix4(matrix);original.fromBufferAttribute(geometry.attributes.position,i);assert.ok(point.distanceTo(original)<1e-6);
      point.fromBufferAttribute(unit.attributes.normal,i).applyNormalMatrix(normalMatrix);original.fromBufferAttribute(geometry.attributes.normal,i);assert.ok(point.distanceTo(original)<1e-6);
    }
    geometry.dispose();
  }unit.dispose();
});
