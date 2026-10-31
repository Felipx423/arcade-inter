import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { shadowCanReach } from '../src/static-view.ts';

test('cache invalida quando o volume varrido pela sombra alcança um receptor',()=>{
  const caster=new THREE.Box3(new THREE.Vector3(-.2,4,-.2),new THREE.Vector3(.2,4.5,.2));
  const direction=new THREE.Vector3(3,-7,-6).normalize();
  const left=new THREE.Box3(new THREE.Vector3(-6,0,-.3),new THREE.Vector3(-3,6,4));
  const right=new THREE.Box3(new THREE.Vector3(3,0,-.3),new THREE.Vector3(6,6,4));
  assert.equal(shadowCanReach(caster,left,direction),false);
  assert.equal(shadowCanReach(caster,right,direction),false);
  const floor=new THREE.Box3(new THREE.Vector3(0,-.1,-5),new THREE.Vector3(3,.1,0));
  assert.equal(shadowCanReach(caster,floor,direction),true);
  assert.equal(shadowCanReach(caster,caster,new THREE.Vector3(0,-1,0)),true);
});
