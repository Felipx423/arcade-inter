import {useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import * as THREE from 'three';

export const cylinderMetrics={sources:0,batches:0};
export default function DynamicCylinders(){
  const {scene}=useThree(),token=useRef(0);
  useFrame(()=>{token.current++;},-10);
  useLayoutEffect(()=>{
    const groups=new Map<string,THREE.Mesh[]>();
    scene.traverseVisible(o=>{
      if(!(o instanceof THREE.Mesh) || !o.userData.pegaCylinder)return;
      for(let parent=o.parent;parent;parent=parent.parent)if(parent.userData.staticArcade)return;
      const material=o.material as THREE.MeshPhysicalMaterial;
      const key=[material.metalness,material.roughness,material.clearcoat,material.emissive.getHex(),material.emissiveIntensity,o.castShadow,o.receiveShadow].join(':');
      const group=groups.get(key)??[];group.push(o);groups.set(key,group);
    });
    const geometry=new THREE.CylinderGeometry(1,1,1,24),dispose:(()=>void)[]=[];
    for(const sources of groups.values()){
      if(sources.length<2)continue;
      const material=(sources[0].material as THREE.MeshPhysicalMaterial).clone();material.color.set('white');
      const batch=new THREE.InstancedMesh(geometry,material,sources.length);
      batch.castShadow=sources[0].castShadow;batch.receiveShadow=sources[0].receiveShadow;batch.frustumCulled=false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      const scale=new THREE.Matrix4(),transform=new THREE.Matrix4();let last=-1;
      const update=()=>{
        if(last===token.current)return;last=token.current;
        sources.forEach((source,i)=>{
          source.updateWorldMatrix(true,false);
          const {radius,height}=source.userData.pegaCylinder;
          transform.multiplyMatrices(source.matrixWorld,scale.makeScale(radius,height,radius));batch.setMatrixAt(i,transform);
        });batch.instanceMatrix.needsUpdate=true;
      };
      sources.forEach((source,i)=>{batch.setColorAt(i,(source.material as THREE.MeshPhysicalMaterial).color);source.visible=false;});
      batch.onBeforeRender=update;batch.onBeforeShadow=update;scene.add(batch);update();
      cylinderMetrics.sources+=sources.length;cylinderMetrics.batches++;
      dispose.push(()=>{scene.remove(batch);batch.dispose();material.dispose();sources.forEach(s=>s.visible=true);cylinderMetrics.sources-=sources.length;cylinderMetrics.batches--;});
    }
    return ()=>{dispose.forEach(fn=>fn());geometry.dispose();};
  },[scene]);
  return null;
}
