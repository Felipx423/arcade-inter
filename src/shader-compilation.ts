import * as THREE from 'three';

/** A compile-only view: Three's compile traversal must see the real mesh types. */
export function compilationView(scene:THREE.Scene){
  const objects=new Set<THREE.Object3D>();
  scene.traverseVisible(object=>{if(object instanceof THREE.Mesh)objects.add(object);});
  scene.traverse(object=>{if(object instanceof THREE.Mesh && object.userData.warmShader)objects.add(object);});
  const view=new THREE.Group();
  // No add/remove/clear: these objects still belong to the live scene.
  view.children.push(...objects);
  return {view,release(){view.children.length=0;}};
}
