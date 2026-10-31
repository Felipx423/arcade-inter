import * as THREE from 'three';

const bounds = new THREE.Box3(), position = new THREE.Vector3();
export function pointLightMask(mesh: THREE.Mesh, lights: THREE.PointLight[]) {
  if (lights.length > 30) return -1;
  if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
  bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  let mask = 0;
  lights.forEach((light, i) => {
    light.getWorldPosition(position);
    if (!light.distance || bounds.distanceToPoint(position) <= light.distance + .001) mask |= 1 << i;
  });
  return mask;
}

/** Fixed room lights, in Three's stable traversal order. Out-of-range attenuation is exactly zero. */
export function specializePointLights(material: THREE.Material, mask: number, count: number) {
  const original = material.onBeforeCompile, key = material.customProgramCacheKey;
  const chunk = THREE.ShaderChunk.lights_fragment_begin;
  const start = 'pointLight = pointLights[ i ];';
  const end = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
  const from = chunk.indexOf(start), to = chunk.indexOf(end, from) + end.length;
  if (from < 0 || to < end.length) return;
  const specialized = chunk.slice(0,from) + `\n#if ( NUM_POINT_LIGHTS != ${count} ) || ( ( PEGA_POINT_MASK & ( 1 << UNROLLED_LOOP_INDEX ) ) != 0 )\n` + chunk.slice(from,to) + '\n#endif\n' + chunk.slice(to);
  (material as THREE.MeshStandardMaterial).defines = { ...(material as THREE.MeshStandardMaterial).defines, PEGA_POINT_MASK: mask };
  material.onBeforeCompile = function(shader, renderer) { original.call(this,shader,renderer); shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',specialized); };
  material.customProgramCacheKey=()=>`${key.call(material)}|pega-point-mask:${mask}:${count}`;
  material.needsUpdate=true;
}

export function roomPointLights(root: THREE.Object3D) {
  let scene = root; while (scene.parent) scene=scene.parent;
  scene.updateWorldMatrix(true,true);
  const lights: THREE.PointLight[]=[];
  scene.traverseVisible(o=>{ if (o instanceof THREE.PointLight) lights.push(o); });
  // Same stable shadow-first order as the pinned WebGLLights implementation.
  return lights.sort((a,b)=>Number(b.castShadow)-Number(a.castShadow));
}
