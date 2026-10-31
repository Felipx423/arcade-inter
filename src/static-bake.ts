import * as THREE from 'three';

const direct='RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const chunk=THREE.ShaderChunk.lights_fragment_begin;
const begin=chunk.indexOf('getDirectionalLightInfo( directionalLight, directLight );');
const end=chunk.indexOf(direct,begin)+direct.length;
const directionalBody=chunk.slice(begin,end).replace(/directLight\.color \*=.*getShadow\( directionalShadowMap[^\n]+/,'');
const capture=`{
 vec3 pegaBefore=reflectedLight.directDiffuse+reflectedLight.directSpecular;
 #ifdef USE_CLEARCOAT
 vec3 pegaCoatBefore=clearcoatSpecularDirect;
 #endif
 ${directionalBody}
 if(UNROLLED_LOOP_INDEX==0){
  pegaDirectional=reflectedLight.directDiffuse+reflectedLight.directSpecular-pegaBefore;
  #ifdef USE_CLEARCOAT
  pegaCoatDirectional=clearcoatSpecularDirect-pegaCoatBefore;
  #endif
 }
}`;
const bakedChunk=chunk.slice(0,begin)+capture+chunk.slice(end);

export function createBakeMaterial(original:THREE.MeshStandardMaterial,receiveShadow:boolean){
  const material=original.clone();material.fog=false;
  material.onBeforeCompile=shader=>{
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',`#include <common>
        layout(location=1) out highp vec4 pegaDirectOutput;
        layout(location=2) out highp vec4 pegaShadowHigh;
        layout(location=3) out highp vec4 pegaShadowLow;
        vec3 pegaDirectional=vec3(0.0),pegaCoatDirectional=vec3(0.0);`)
      .replace('#include <lights_fragment_begin>',bakedChunk)
      .replace('#include <opaque_fragment>',`
        #ifdef USE_CLEARCOAT
        pegaDirectional=pegaDirectional*(1.0-material.clearcoat*Fcc)+pegaCoatDirectional*material.clearcoat;
        #endif
        gl_FragColor=vec4(outgoingLight,1.0);
        pegaDirectOutput=vec4(${receiveShadow?'pegaDirectional':'vec3(0.0)'},1.0);
        vec3 pegaCoord=vDirectionalShadowCoord[0].xyz/vDirectionalShadowCoord[0].w;
        vec3 pegaHigh=floor(pegaCoord*1024.0)/1024.0;
        pegaShadowHigh=vec4(pegaHigh,1.0);
        pegaShadowLow=vec4(pegaCoord-pegaHigh,1.0);
      `);
  };
  material.customProgramCacheKey=()=>`pega-static-bake-v1:${receiveShadow}`;
  return material;
}

const shadowChunk=THREE.ShaderChunk.shadowmap_pars_fragment;
export const cachedShadowFunctions=shadowChunk.slice(shadowChunk.indexOf('float interleavedGradientNoise'),shadowChunk.indexOf('\n\t#elif defined( SHADOWMAP_TYPE_VSM )'))
  .replace(/#endif/g,'').replace(/#if defined\( SHADOWMAP_TYPE_PCF \)/g,'');
