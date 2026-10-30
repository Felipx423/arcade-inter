import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceWorld, createWorld, FLOOR_Y, kickBall, RADIUS } from '../src/physics.ts';
import { capsulePositions } from '../src/controller.ts';

const run = (world, seconds, pinned = -1, obstacle) => {
  for (let i = 0; i < seconds * 120; i++) advanceWorld(world, 1 / 120, pinned, obstacle);
};
test('gravidade, colisões, piso, paredes e repouso com 12 cápsulas', () => {
  const world = createWorld(capsulePositions(12));
  const initialY = world.balls[0].y;
  run(world, .1);
  assert.ok(world.balls[0].y < initialY);
  run(world, 12);
  for (const b of world.balls) {
    assert.ok(b.y >= FLOOR_Y - .001 && Number.isFinite(b.y));
    assert.ok(b.x >= -1.291 && b.x <= 1.291);
    assert.ok(b.z >= -.881 && b.z <= .941);
    assert.ok(Math.hypot(b.x - 1.3, b.z - .72) >= .595, 'borda protege saída');
  }
  for (let i = 0; i < world.balls.length; i++) for (let j = i + 1; j < world.balls.length; j++) {
    const a = world.balls[i], b = world.balls[j];
    assert.ok(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) >= RADIUS * 2 - .007);
  }
  assert.equal(world.awake, false, 'cena pode parar de renderizar');
});
test('toque acorda cápsula e transfere impulso em uma colisão', () => {
  const world = createWorld([{ x: -.4, z: 0 }, { x: .15, z: 0 }], true);
  kickBall(world, 0, 2, 0);
  assert.equal(world.awake, true);
  run(world, .5);
  assert.ok(world.balls[0].y > FLOOR_Y || world.balls[0].x > -.4);
  assert.ok(world.balls[1].x > .15);
  run(world, 8);
  assert.equal(world.awake, false);
});
test('garra empurra vizinhas sem deslocar a cápsula vinculada', () => {
  const world = createWorld([{ x: 0, z: 0 }, { x: .55, z: 0 }], true);
  const target = { ...world.balls[0] };
  run(world, .5, 0, { x: .38, y: FLOOR_Y + .12, z: 0, radius: .31 });
  assert.equal(world.balls[0].x, target.x);
  assert.equal(world.balls[0].y, target.y);
  assert.ok(world.balls[1].x > .55);
});
test('intervalos grandes e esferas coincidentes não geram valores inválidos', () => {
  const world = createWorld([{ x: 0, z: 0 }, { x: 0, z: 0 }]);
  advanceWorld(world, 30);
  run(world, 10);
  assert.ok(world.balls.every(b => [b.x,b.y,b.z,b.vx,b.vy,b.vz].every(Number.isFinite)));
  assert.ok(Math.hypot(world.balls[0].x-world.balls[1].x,world.balls[0].z-world.balls[1].z) > .5);
});
