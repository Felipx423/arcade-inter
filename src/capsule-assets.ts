import * as THREE from 'three';

export function createCapsuleAssets(colors: string[]) {
  const lower=new THREE.SphereGeometry(.25,32,20,0,Math.PI*2,Math.PI/2,Math.PI/2);
  const upper=new THREE.SphereGeometry(.25,32,20,0,Math.PI*2,0,Math.PI/2);
  const band=new THREE.TorusGeometry(.25,.008,8,40);
  const bottom=new THREE.MeshPhysicalMaterial({color:'#edf4da',roughness:.1,metalness:.06,transparent:true,opacity:.38,transmission:.55,thickness:.04,ior:1.47,clearcoat:1,clearcoatRoughness:.08,depthWrite:false});
  bottom.userData.pegaCapsule=true;
  const tops=new Map(colors.map((color,index)=>{
    const transparent=index===3;
    const material=new THREE.MeshPhysicalMaterial({color,transparent,opacity:transparent?.42:1,transmission:transparent?.5:0,thickness:.04,roughness:.16,metalness:.04,clearcoat:1,clearcoatRoughness:.08});
    material.userData.pegaCapsule=true;
    return [color,material] as const;
  }));
  const seam=new THREE.MeshPhysicalMaterial({color:'#e1e3c9',transparent:true,opacity:.55,roughness:.19});
  return {lower,upper,band,bottom,tops,seam,dispose(){for(const item of [lower,upper,band,bottom,seam,...tops.values()])item.dispose();}};
}
export type CapsuleAssets=ReturnType<typeof createCapsuleAssets>;
