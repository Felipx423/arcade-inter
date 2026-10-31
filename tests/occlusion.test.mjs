import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {isOccluded} from '../src/occlusion.ts';

test('oclusão só descarta volumes completamente atrás de pixels cobertos',()=>{
  const camera=new THREE.PerspectiveCamera(50,1,.1,20);camera.position.set(0,0,5);camera.updateMatrixWorld();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5));mesh.updateMatrixWorld();
  const pixels=new Uint8Array(8*8*4);pixels.fill(128);
  const grid={width:8,height:8,tile:8,pixels,sourceWidth:64,sourceHeight:64};
  assert.equal(isOccluded(mesh,camera,grid),true);
  pixels.fill(255);assert.equal(isOccluded(mesh,camera,grid),false);
  pixels.fill(128);mesh.position.z=4.8;mesh.updateMatrixWorld();assert.equal(isOccluded(mesh,camera,grid),false);
  mesh.position.set(0,0,0);mesh.updateMatrixWorld();pixels[(4*8+4)*4]=255;pixels[(4*8+4)*4+1]=255;pixels[(4*8+4)*4+2]=255;
  assert.equal(isOccluded(mesh,camera,grid),false);
});
