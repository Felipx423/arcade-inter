import type { Aim } from './types';
export const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
export const boundAim = (aim: Aim): Aim => ({ x: clamp(aim.x, -1.12, 1.12), z: clamp(aim.z, -.72, .72) });
export function capsulePositions(total: number): Aim[] {
  const count = Math.min(12, Math.max(0, total));
  if (count === 1) return [{ x: 0, z: 0 }];
  // Pontos orgânicos de partida; o simulador resolve contatos e acomodação.
  const scattered = [
    [-.86, -.44], [.52, .35], [-.43, .57], [.78, -.60],
    [-.13, -.37], [-1.05, .27], [.34, -.69], [.12, .69],
    [.98, -.11], [-.57, -.03], [-.94, .72], [.09, .07],
  ];
  return scattered.slice(0, count).map(([x, z]) => ({ x, z }));
}
export function nearestCapsule(positions: Aim[], aim: Aim) {
  let best = 0;
  let distance = Infinity;
  positions.forEach((p, index) => { const d = (p.x - aim.x) ** 2 + (p.z - aim.z) ** 2; if (d < distance) { best = index; distance = d; } });
  return best;
}
export const ease = (t: number) => { const n = clamp(t, 0, 1); return n * n * (3 - 2 * n); };
export const mix = (a: number, b: number, t: number) => a + (b - a) * ease(t);
