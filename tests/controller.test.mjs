import test from 'node:test';
import assert from 'node:assert/strict';
import { boundAim, capsulePositions, nearestCapsule } from '../src/controller.ts';
test('mira respeita limites nos dois eixos e seleciona pela distância', () => {
  assert.deepEqual(boundAim({ x: 9, z: -9 }), { x: 1.12, z: -.72 });
  const positions = capsulePositions(12);
  assert.equal(nearestCapsule(positions, positions[11]), 11);
  assert.equal(nearestCapsule(positions, positions[0]), 0);
});
test('cápsulas são limitadas a 12, com última unidade centralizada', () => {
  assert.deepEqual(capsulePositions(0), []);
  assert.deepEqual(capsulePositions(1), [{ x: 0, z: 0 }]);
  assert.equal(capsulePositions(100000).length, 12);
  for (let count = 2; count <= 12; count++) for (const p of capsulePositions(count)) {
    assert.ok(Math.abs(p.x) <= 1.12 && Math.abs(p.z) <= .72);
  }
});
