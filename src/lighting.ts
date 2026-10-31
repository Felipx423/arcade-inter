import * as THREE from 'three';

const direct = 'RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );';
const chunk = THREE.ShaderChunk.lights_fragment_begin;
const pointInfo = 'getPointLightInfo( pointLight, geometryPosition, directLight );';
const pointBegin = chunk.indexOf(pointInfo), pointEnd = chunk.indexOf(direct, pointBegin) + direct.length;
const pointBody = chunk.slice(pointBegin, pointEnd);
const fastPointBody = `{ vec3 pegaLightVector = pointLight.position - geometryPosition;
float pegaDistanceSquared = dot(pegaLightVector, pegaLightVector);
if ((pointLight.distance <= 0.0 || pegaDistanceSquared < pointLight.distance * pointLight.distance) &&
    (dot(geometryNormal, pegaLightVector) > 0.0 || dot(geometryClearcoatNormal, pegaLightVector) > 0.0)) {
  ${pointBody}
} }`;
const optimizedChunk = chunk.replace(pointBody,fastPointBody).split(direct).join(`if ( directLight.visible && ( dot( geometryNormal, directLight.direction ) > 0.0 || dot( geometryClearcoatNormal, directLight.direction ) > 0.0 ) ) { ${direct} }`);
const pointParameters = THREE.ShaderChunk.lights_pars_begin.replace(
  'light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );',
  `if (pointLight.decay == 2.0) {
    float d2 = dot(lVector,lVector);
    float attenuation = 1.0 / max(d2,0.01);
    if(pointLight.distance > 0.0) attenuation *= pow2(saturate(1.0-pow2(d2/(pointLight.distance*pointLight.distance))));
    light.color *= attenuation;
  } else {
    light.color *= getDistanceAttenuation(length(lVector),pointLight.distance,pointLight.decay);
  }`
).replace('float lightDistance = length( lVector );','');

/** These BRDF terms are exactly zero for a light outside range or behind both lobes. */
export function optimizeDirectLighting(material: THREE.Material) {
  const original = material.onBeforeCompile, key = material.customProgramCacheKey;
  material.onBeforeCompile = function (shader, renderer) {
    original.call(this, shader, renderer);
    if (chunk.includes(direct)) shader.fragmentShader = shader.fragmentShader.replace('#include <lights_fragment_begin>', optimizedChunk).replace('#include <lights_pars_begin>',pointParameters);
  };
  material.customProgramCacheKey = () => `${key.call(material)}|pega-zero-irradiance-v2`;
  material.needsUpdate = true;
  return () => { material.onBeforeCompile = original; material.customProgramCacheKey = key; material.needsUpdate = true; };
}
