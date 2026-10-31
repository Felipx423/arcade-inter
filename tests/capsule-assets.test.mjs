import test from 'node:test';
import assert from 'node:assert/strict';
import { createCapsuleAssets } from '../src/capsule-assets.ts';

test('recursos compartilhados mantêm tesselação, transmissão e descarte único',()=>{
  const assets=createCapsuleAssets(['#001D89','#56D867','#FFF8E1','#dce9d3']);
  assert.equal(assets.lower.parameters.widthSegments,32); assert.equal(assets.lower.parameters.heightSegments,20);
  assert.equal(assets.bottom.transmission,.55); assert.equal(assets.bottom.opacity,.38);
  assert.equal(assets.tops.get('#dce9d3').transmission,.5);
  assert.equal(assets.tops.get('#56D867').transmission,0);
  let disposed=0;
  for(const item of [assets.lower,assets.upper,assets.band,assets.bottom,assets.seam,...assets.tops.values()]) item.addEventListener('dispose',()=>disposed++);
  assets.dispose(); assert.equal(disposed,9);
});
