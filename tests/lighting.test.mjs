import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { optimizeDirectLighting } from '../src/lighting.ts';
test('shader preserva contribuição do verniz e faz fallback em shaders desconhecidos', () => {
  const material = new THREE.MeshPhysicalMaterial({clearcoat:1});
  const original = material.onBeforeCompile; const restore = optimizeDirectLighting(material);
  const shader = { fragmentShader: '#include <lights_fragment_begin>' };
  material.onBeforeCompile(shader, {});
  assert.ok(shader.fragmentShader.includes('dot( geometryNormal, directLight.direction ) > 0.0'));
  assert.ok(shader.fragmentShader.includes('dot( geometryClearcoatNormal, directLight.direction ) > 0.0'));
  assert.equal((shader.fragmentShader.match(/RE_Direct\(/g)||[]).length, (THREE.ShaderChunk.lights_fragment_begin.match(/RE_Direct\(/g)||[]).length);
  const custom = {fragmentShader:'void main() {}'}; material.onBeforeCompile(custom, {}); assert.equal(custom.fragmentShader,'void main() {}');
  restore(); assert.equal(material.onBeforeCompile,original);
});

test('atenuação por distância quadrática é equivalente ao decaimento físico padrão',()=>{
  for(const cutoff of [0,.1,2,5,7]) for(let i=0;i<=1000;i++){
    const d=i*.013, d2=d*d;
    const original=1/Math.max(d**2,.01)*(cutoff>0?Math.max(0,1-(d/cutoff)**4)**2:1);
    const optimized=1/Math.max(d2,.01)*(cutoff>0?Math.max(0,1-(d2/(cutoff*cutoff))**2)**2:1);
    assert.ok(Math.abs(original-optimized)<1e-10);
  }
});
