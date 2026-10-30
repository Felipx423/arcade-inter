import type { Aim } from './types';

// Corpos esféricos: passo fixo, gravidade, impulsos, atrito e repouso.
// A captura usa um vínculo cinemático; o prêmio nunca depende da simulação.
export const RADIUS = .265;
export const FLOOR_Y = 2.12 + RADIUS;
const STEP = 1 / 120;
export interface Ball {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  rx: number; ry: number; rz: number;
  hidden: boolean;
  colorIndex: number;
}
export interface BallWorld { balls: Ball[]; accumulator: number; quiet: number; awake: boolean; }
export interface Obstacle { x: number; y: number; z: number; radius: number; }
export function createBall(p: Aim, index: number, settled = false): Ball {
  return { ...p, y: settled ? FLOOR_Y : FLOOR_Y + .25 + (index % 4) * .19,
    vx: settled ? 0 : Math.sin(index * 2.17 + .4) * .5, vy: 0,
    vz: settled ? 0 : Math.cos(index * 1.91 + .3) * .42,
    rx: index * .87, ry: index * 1.33, rz: index * .41, hidden: false, colorIndex: index % 4 };
}
export function createWorld(positions: Aim[], settled = false): BallWorld {
  const world = { balls: positions.map((p, i) => createBall(p, i, settled)), accumulator: 0, quiet: 0, awake: !settled && positions.length > 0 };
  if (settled) for (let i = 0; i < 360; i++) step(world, -1);
  return world;
}
export function kickBall(world: BallWorld, index: number, dx = .8, dz = -.55) {
  const b = world.balls[index]; if (!b || b.hidden) return;
  b.vx += dx; b.vz += dz; b.vy += 1.6;
  world.awake = true; world.quiet = 0;
}
function boundaries(b: Ball) {
  if (b.x < -1.29) { b.x = -1.29; b.vx = Math.abs(b.vx) * .38; }
  if (b.x > 1.29) { b.x = 1.29; b.vx = -Math.abs(b.vx) * .38; }
  if (b.z < -.88) { b.z = -.88; b.vz = Math.abs(b.vz) * .38; }
  if (b.z > .94) { b.z = .94; b.vz = -Math.abs(b.vz) * .38; }
  // A borda da saída segura as cápsulas até a garra as transportar.
  if (b.y < 2.85) {
    const dx = b.x - 1.3, dz = b.z - .72;
    const d = Math.hypot(dx, dz);
    if (d < .60) {
      const nx = d > .0001 ? dx / d : -1, nz = d > .0001 ? dz / d : 0;
      b.x = 1.3 + nx * .60; b.z = .72 + nz * .60;
      const speed = b.vx * nx + b.vz * nz;
      if (speed < 0) { b.vx -= speed * 1.38 * nx; b.vz -= speed * 1.38 * nz; }
      if (b.z > .94) {
        b.z = .94;
        b.x = Math.min(b.x, 1.3 - Math.sqrt(.60 ** 2 - (.94 - .72) ** 2));
      }
    }
  }
  if (b.y < FLOOR_Y) {
    b.y = FLOOR_Y;
    b.vy = b.vy < -.25 ? -b.vy * .34 : 0;
  }
}
function step(world: BallWorld, pinned: number, obstacle?: Obstacle) {
  const balls = world.balls;
  for (let i = 0; i < balls.length; i++) {
    const b = balls[i]; if (b.hidden || i === pinned) continue;
    const grounded = b.y <= FLOOR_Y + .012;
    const drag = Math.exp(-(grounded ? 3.8 : .15) * STEP);
    b.vx *= drag; b.vz *= drag; b.vy -= 9.8 * STEP;
    b.x += b.vx * STEP; b.y += b.vy * STEP; b.z += b.vz * STEP;
    b.rx += b.vz / RADIUS * STEP; b.rz -= b.vx / RADIUS * STEP;
    boundaries(b);
  }
  for (let iteration = 0; iteration < 5; iteration++) {
    for (let i = 0; i < balls.length; i++) {
      const a = balls[i]; if (a.hidden) continue;
      for (let j = i + 1; j < balls.length; j++) {
        const b = balls[j]; if (b.hidden) continue;
        let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
        let distance = Math.hypot(dx, dy, dz);
        if (distance >= RADIUS * 2) continue;
        if (distance < .00001) { dx = .0001; dy = 0; dz = 0; distance = .0001; }
        const nx = dx / distance, ny = dy / distance, nz = dz / distance;
        const ma = i === pinned ? 0 : 1, mb = j === pinned ? 0 : 1, mass = ma + mb;
        if (!mass) continue;
        const correction = Math.max(0, RADIUS * 2 - distance + .0001) / mass;
        a.x -= nx * correction * ma; a.y -= ny * correction * ma; a.z -= nz * correction * ma;
        b.x += nx * correction * mb; b.y += ny * correction * mb; b.z += nz * correction * mb;
        const closing = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny + (b.vz - a.vz) * nz;
        if (closing < 0) {
          const impulse = -(1 + .30) * closing / mass;
          a.vx -= impulse * nx * ma; a.vy -= impulse * ny * ma; a.vz -= impulse * nz * ma;
          b.vx += impulse * nx * mb; b.vy += impulse * ny * mb; b.vz += impulse * nz * mb;
        }
      }
      if (i !== pinned && obstacle) {
        const dx = a.x - obstacle.x, dy = a.y - obstacle.y, dz = a.z - obstacle.z;
        const distance = Math.hypot(dx, dy, dz), contact = RADIUS + obstacle.radius;
        if (distance < contact && distance > .0001) {
          const nx = dx / distance, ny = dy / distance, nz = dz / distance;
          a.x += nx * (contact - distance); a.y += ny * (contact - distance); a.z += nz * (contact - distance);
          a.vx += nx * .07; a.vz += nz * .07; a.vy += Math.max(0, ny) * .03;
        }
      }
      if (i !== pinned) boundaries(a);
    }
  }
}
export function advanceWorld(world: BallWorld, delta: number, pinned = -1, obstacle?: Obstacle) {
  if (obstacle) { world.awake = true; world.quiet = 0; }
  if (!world.awake) return false;
  world.accumulator += Math.min(Math.max(delta, 0), .1);
  while (world.accumulator >= STEP) { step(world, pinned, obstacle); world.accumulator -= STEP; }
  const moving = world.balls.some((b, i) => !b.hidden && i !== pinned &&
    (Math.hypot(b.vx, b.vy, b.vz) > .055 || b.y > FLOOR_Y + .015));
  world.quiet = moving ? 0 : world.quiet + Math.min(delta, .1);
  if (world.quiet > .55) {
    world.awake = false;
    for (const b of world.balls) { b.vx = b.vy = b.vz = 0; }
  }
  return world.awake;
}
