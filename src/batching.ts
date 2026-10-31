import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export const batchMetrics = { sources: 0, batches: 0, rejected: {} as Record<string, number> };

export function materialKey(material: THREE.Material,ignoreColor=false,allowOptimized=false): string | null {
  if (![THREE.MeshPhysicalMaterial, THREE.MeshStandardMaterial, THREE.MeshBasicMaterial].includes(material.constructor as typeof THREE.MeshPhysicalMaterial)) return null;
  const optimized=allowOptimized && material.customProgramCacheKey().includes('pega-zero-irradiance-v2');
  if (material.transparent || (material as THREE.MeshPhysicalMaterial).transmission > 0 || (!optimized && material.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile)) return null;
  const properties: Record<string, unknown> = {};
  for (const name of Object.keys(material).sort()) {
    if (['uuid', 'version', 'name', 'userData', '_listeners', '__r3f','onBeforeCompile','customProgramCacheKey'].includes(name) || (ignoreColor && name==='color')) continue;
    const value = (material as unknown as Record<string, unknown>)[name];
    if (value === null || ['number', 'boolean', 'string'].includes(typeof value)) properties[name] = value;
    else if (value instanceof THREE.Texture) properties[name] = value.uuid;
    else if (value instanceof THREE.Color || value instanceof THREE.Vector2 || value instanceof THREE.Vector3 || value instanceof THREE.Matrix3 || value instanceof THREE.Euler) properties[name] = value.toArray();
    else if (Array.isArray(value) && value.every(n => typeof n === 'number')) properties[name] = value;
    else if (name === 'defines') properties[name] = value;
    else { batchMetrics.rejected[name] = (batchMetrics.rejected[name] ?? 0) + 1; return null; }
  }
  return JSON.stringify(properties);
}

/** Bake only opaque, non-interactive scenery. Original attributes and tessellation stay intact. */
export function batchStaticMeshes(root: THREE.Group) {
  root.updateWorldMatrix(true, true);
  const inverse = root.matrixWorld.clone().invert();
  const groups = new Map<string, THREE.Mesh[]>();
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || Array.isArray(object.material) || object instanceof THREE.InstancedMesh || object instanceof THREE.SkinnedMesh || object instanceof THREE.BatchedMesh) return;
    if(object.geometry.hasAttribute('color'))return;
    const signature = materialKey(object.material,true);
    if (signature === null) return;
    const attributes = Object.keys(object.geometry.attributes).sort().map(k => `${k}:${object.geometry.attributes[k].itemSize}:${object.geometry.attributes[k].normalized}`).join(',');
    const key = `${signature}|${attributes}|${Boolean(object.geometry.index)}|${object.castShadow}|${object.receiveShadow}|${object.renderOrder}|${object.layers.mask}`;
    const list = groups.get(key) ?? []; list.push(object); groups.set(key, list);
  });
  const meshes: THREE.Mesh[] = [], hidden: THREE.Mesh[] = [];
  for (const sources of groups.values()) {
    if (sources.length < 2) continue;
    const copies = sources.map(source => {
      const geometry=source.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inverse, source.matrixWorld));
      const color=(source.material as THREE.MeshStandardMaterial).color,values=new Float32Array(geometry.getAttribute('position').count*3);
      for(let i=0;i<values.length;i+=3){values[i]=color.r;values[i+1]=color.g;values[i+2]=color.b;}
      geometry.setAttribute('color',new THREE.BufferAttribute(values,3));return geometry;
    });
    const geometry = mergeGeometries(copies, false); copies.forEach(copy => copy.dispose());
    if (!geometry) continue;
    geometry.computeBoundingSphere(); geometry.computeBoundingBox();
    const first = sources[0],material=(first.material as THREE.MeshStandardMaterial).clone();material.color.set('white');material.vertexColors=true;
    const batch = new THREE.Mesh(geometry, material);
    batch.name = `static-batch-${sources.length}`; batch.castShadow = first.castShadow; batch.receiveShadow = first.receiveShadow; batch.renderOrder = first.renderOrder; batch.layers.mask = first.layers.mask;
    batch.matrixAutoUpdate = false; root.add(batch); meshes.push(batch);
    for (const source of sources) { source.visible = false; hidden.push(source); }
  }
  batchMetrics.sources += hidden.length; batchMetrics.batches += meshes.length;
  let disposed=false;
  return { meshes, dispose() { if(disposed)return;disposed=true;for (const mesh of meshes) { root.remove(mesh); mesh.geometry.dispose();(mesh.material as THREE.Material).dispose(); } for (const source of hidden) source.visible = true;batchMetrics.sources-=hidden.length;batchMetrics.batches-=meshes.length; } };
}
