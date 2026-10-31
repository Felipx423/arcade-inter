import * as THREE from 'three';

const box = new THREE.Box3(), point = new THREE.Vector3(), projected = new THREE.Vector4(), scale = new THREE.Vector3();
const projection = new THREE.Matrix4();
export const transmissionMetrics = { passes: 0, pixelFraction: 1 };

export function transmissionRegion(scene: THREE.Object3D, camera: THREE.Camera, width: number, height: number) {
  const full = new THREE.Vector4(0, 0, width, height);
  let minX = 1, minY = 1, maxX = -1, maxY = -1, fallback = false, found = false;
  projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  scene.traverseVisible(object => {
    const mesh = object as THREE.Mesh;
    if (!mesh.geometry || !mesh.material) return;
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      const m = material as THREE.MeshPhysicalMaterial;
      if (!(m.transmission > 0)) continue;
      found = true;
      if (!m.userData.pegaCapsule || m.roughness > .2 || m.roughnessMap || m.normalMap || m.bumpMap || m.dispersion > 0) { fallback = true; continue; }
      if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
      box.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
      mesh.getWorldScale(scale); box.expandByScalar(m.thickness * Math.max(scale.x, scale.y, scale.z));
      for (let i=0;i<8;i++) {
        point.set(i&1 ? box.max.x : box.min.x, i&2 ? box.max.y : box.min.y, i&4 ? box.max.z : box.min.z);
        projected.set(point.x,point.y,point.z,1).applyMatrix4(projection);
        if (projected.w <= .2) { fallback = true; continue; }
        const x = projected.x/projected.w, y=projected.y/projected.w;
        minX=Math.min(minX,x); minY=Math.min(minY,y); maxX=Math.max(maxX,x); maxY=Math.max(maxY,y);
      }
    }
  });
  if (fallback || !found) return full;
  // Full-size radiance target: restrict rasterization, with a generous mip/filter halo.
  const padding = Math.max(64, 4 * 2 ** Math.ceil(Math.log2(Math.max(width,height)) * .4));
  const x=Math.max(0,Math.floor((minX*.5+.5)*width-padding));
  const y=Math.max(0,Math.floor((minY*.5+.5)*height-padding));
  const right=Math.min(width,Math.ceil((maxX*.5+.5)*width+padding));
  const top=Math.min(height,Math.ceil((maxY*.5+.5)*height+padding));
  return right > x && top > y ? new THREE.Vector4(x,y,right-x,top-y) : full;
}

export function installTransmissionRegion(gl: THREE.WebGLRenderer) {
  const render = gl.render;
  const setTarget = gl.setRenderTarget as (target: THREE.WebGLRenderTarget<THREE.Texture | THREE.Texture[]> | null, face?: number, mip?: number) => void;
  let activeScene: THREE.Object3D | null = null, activeCamera: THREE.Camera | null = null;
  const targets = new Set<{ scissor: THREE.Vector4; scissorTest: boolean; width: number; height: number }>();
  gl.render = function (scene, camera) { const previousScene=activeScene, previousCamera=activeCamera; activeScene=scene; activeCamera=camera; try { return render.call(gl,scene,camera); } finally { activeScene=previousScene; activeCamera=previousCamera; } };
  gl.setRenderTarget = function (target, face, mip) {
    if (target && target.samples >= 4 && !Array.isArray(target.texture) && target.texture.generateMipmaps && target.depthBuffer && activeScene && activeCamera) {
      const region = transmissionRegion(activeScene,activeCamera,target.width,target.height);
      target.scissor.copy(region); target.scissorTest=true; targets.add(target);
      transmissionMetrics.passes++; transmissionMetrics.pixelFraction=(region.z*region.w)/(target.width*target.height);
    }
    return setTarget.call(gl,target,face,mip);
  };
  return () => { gl.render=render; gl.setRenderTarget=setTarget; for (const target of targets) { target.scissorTest=false; target.scissor.set(0,0,target.width,target.height); } };
}
