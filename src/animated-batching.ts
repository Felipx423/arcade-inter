import * as THREE from 'three';
import {materialKey} from './batching.ts';

const ZERO_MATRIX = new THREE.Matrix4().makeScale(0, 0, 0);
const instanceBox = new THREE.Box3();

export const animatedBatchMetrics={sources:0,batches:0};
export function createAnimatedBatches(scene:THREE.Scene){
  const groups=new Map<string,THREE.Mesh[]>();
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.BatchedMesh || !o.visible || o.userData.warmShader || Array.isArray(o.material))return;
    for(let p=o.parent;p;p=p.parent)if(p.userData.staticArcade || p.userData.staticScenery || p.userData.individualDraw)return;
    const signature=materialKey(o.material,true,true);if(signature===null)return;
    const attributes=Object.keys(o.geometry.attributes).sort().map(k=>{const a=o.geometry.getAttribute(k);return `${k}:${a.itemSize}:${a.normalized}`;}).join(',');
    const key=[signature,attributes,Boolean(o.geometry.index),o.castShadow,o.receiveShadow,o.renderOrder,o.layers.mask].join('|');
    const sources=groups.get(key)??[];sources.push(o);groups.set(key,sources);
  });
  const batches:THREE.BatchedMesh[]=[],updates:(()=>void)[]=[];
  for(const sources of groups.values()){
    if(sources.length<2)continue;
    const unique=[...new Set(sources.map(s=>s.geometry))];
    const material=(sources[0].material as THREE.MeshStandardMaterial).clone();material.color.set('white');
    const batch=new THREE.BatchedMesh(sources.length,unique.reduce((n,g)=>n+g.getAttribute('position').count,0),unique.reduce((n,g)=>n+(g.index?.count??0),0),material);
    batch.castShadow=sources[0].castShadow;batch.receiveShadow=sources[0].receiveShadow;batch.renderOrder=sources[0].renderOrder;batch.layers.mask=sources[0].layers.mask;
    batch.frustumCulled=false;
    const geometries=new Map(unique.map(g=>[g,batch.addGeometry(g)]));
    const ids=sources.map(source=>{const id=batch.addInstance(geometries.get(source.geometry)!);batch.setColorAt(id,(source.material as THREE.MeshStandardMaterial).color);source.visible=false;return id;});
    updates.push(()=>{
      sources.forEach((source,i)=>{
        let visible=true;for(let p=source.parent;p;p=p.parent)if(!p.visible){visible=false;break;}
        batch.setVisibleAt(ids[i],visible);
        if(visible)batch.setMatrixAt(ids[i],source.matrixWorld);
      });
    });
    batches.push(batch);scene.add(batch);animatedBatchMetrics.sources+=sources.length;animatedBatchMetrics.batches++;
  }
  const update=()=>{scene.updateMatrixWorld();updates.forEach(fn=>fn());};update();
  const sourceCount=[...groups.values()].reduce((n,sources)=>n+(sources.length>1?sources.length:0),0);let disposed=false;
  return {batches,update,dispose(){if(disposed)return;disposed=true;batches.forEach(batch=>{scene.remove(batch);batch.dispose();(batch.material as THREE.Material).dispose();});groups.forEach(sources=>{if(sources.length>1)sources.forEach(s=>s.visible=true);});animatedBatchMetrics.sources-=sourceCount;animatedBatchMetrics.batches-=batches.length;}};
}

export function createTransparentInstances(scene:THREE.Scene){
  const groups=new Map<string,{geometry:THREE.BufferGeometry;material:THREE.Material;castShadow:boolean;receiveShadow:boolean;renderOrder:number;layerMask:number;sources:THREE.Mesh[]}>();
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.BatchedMesh || !o.visible || o.userData.warmShader || Array.isArray(o.material))return;
    for(let p=o.parent;p;p=p.parent)if(p.userData.staticArcade || p.userData.staticScenery || p.userData.individualDraw)return;
    const mat=o.material as THREE.MeshPhysicalMaterial;
    if(!mat.transparent && !(mat.transmission>0))return;
    const key=`${o.geometry.uuid}|${mat.uuid}|${o.castShadow}|${o.receiveShadow}|${o.renderOrder}|${o.layers.mask}`;
    let group=groups.get(key);
    if(!group){group={geometry:o.geometry,material:mat,castShadow:o.castShadow,receiveShadow:o.receiveShadow,renderOrder:o.renderOrder,layerMask:o.layers.mask,sources:[]};groups.set(key,group);}
    group.sources.push(o);
  });
  const instances:THREE.InstancedMesh[]=[],updates:(()=>void)[]=[];
  for(const group of groups.values()){
    if(group.sources.length<2)continue;
    const {geometry,material,castShadow,receiveShadow,renderOrder,layerMask,sources}=group;
    if(!geometry.boundingBox)geometry.computeBoundingBox();
    const geomBox=geometry.boundingBox!;
    const instanced=new THREE.InstancedMesh(geometry,material,sources.length);
    instanced.castShadow=castShadow;instanced.receiveShadow=receiveShadow;instanced.renderOrder=renderOrder;instanced.layers.mask=layerMask;
    instanced.frustumCulled=false;instanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    instanced.boundingBox=new THREE.Box3();
    sources.forEach(s=>{s.visible=false;});
    updates.push(()=>{
      instanced.boundingBox!.makeEmpty();
      sources.forEach((source,i)=>{
        let visible=true;for(let p=source.parent;p;p=p.parent)if(!p.visible){visible=false;break;}
        if(visible){
          instanced.setMatrixAt(i,source.matrixWorld);
          instanceBox.copy(geomBox).applyMatrix4(source.matrixWorld);
          instanced.boundingBox!.union(instanceBox);
        }else{
          instanced.setMatrixAt(i,ZERO_MATRIX);
        }
      });
      instanced.instanceMatrix.needsUpdate=true;
    });
    instances.push(instanced);scene.add(instanced);animatedBatchMetrics.sources+=sources.length;animatedBatchMetrics.batches++;
  }
  const sourceCount=[...groups.values()].reduce((n,g)=>n+(g.sources.length>1?g.sources.length:0),0);
  const update=(syncScene=true)=>{if(syncScene)scene.updateMatrixWorld();updates.forEach(fn=>fn());};update();
  let disposed=false;
  return {instances,update,dispose(){if(disposed)return;disposed=true;instances.forEach(inst=>{scene.remove(inst);inst.dispose();});for(const g of groups.values())if(g.sources.length>1)g.sources.forEach(s=>{s.visible=true;});animatedBatchMetrics.sources-=sourceCount;animatedBatchMetrics.batches-=instances.length;}};
}
