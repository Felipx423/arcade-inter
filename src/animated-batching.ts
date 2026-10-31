import * as THREE from 'three';
import {materialKey} from './batching.ts';

export const animatedBatchMetrics={sources:0,batches:0};
export function createAnimatedBatches(scene:THREE.Scene){
  const groups=new Map<string,THREE.Mesh[]>();
  scene.traverse(o=>{
    if(!(o instanceof THREE.Mesh) || o instanceof THREE.InstancedMesh || o instanceof THREE.BatchedMesh || !o.visible || o.userData.warmShader || Array.isArray(o.material))return;
    for(let p=o.parent;p;p=p.parent)if(p.userData.staticArcade || p.userData.individualDraw)return;
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
        if(visible){source.updateWorldMatrix(true,false);batch.setMatrixAt(ids[i],source.matrixWorld);}
      });
    });
    batches.push(batch);scene.add(batch);animatedBatchMetrics.sources+=sources.length;animatedBatchMetrics.batches++;
  }
  const update=()=>updates.forEach(fn=>fn());update();
  const sourceCount=[...groups.values()].reduce((n,sources)=>n+(sources.length>1?sources.length:0),0);let disposed=false;
  return {batches,update,dispose(){if(disposed)return;disposed=true;batches.forEach(batch=>{scene.remove(batch);batch.dispose();(batch.material as THREE.Material).dispose();});groups.forEach(sources=>{if(sources.length>1)sources.forEach(s=>s.visible=true);});animatedBatchMetrics.sources-=sourceCount;animatedBatchMetrics.batches-=batches.length;}};
}
