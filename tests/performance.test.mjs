import test from 'node:test';
import assert from 'node:assert/strict';
import { statistics, summarize } from '../src/performance.mjs';

test('percentis usam amostras completas e FPS usa tempo total, sem média enganosa de FPS', () => {
  const report = summarize([10, 10, 10, 70]);
  assert.equal(report.mean, 25);
  assert.equal(report.p95, 70);
  assert.equal(report.p99, 70);
  assert.equal(report.fps, 40);
  assert.equal(summarize([]).fps, 0);
});

test('contagens não são convertidas em FPS e estatísticas não alteram as amostras',()=>{
  const counts=[203,192,190],original=[...counts],report=statistics(counts);
  assert.equal(report.samples,3);assert.equal(report.p95,203);assert.equal(report.max,203);
  assert.equal('fps' in report,false);assert.deepEqual(counts,original);assert.equal(statistics([]).samples,0);
});
