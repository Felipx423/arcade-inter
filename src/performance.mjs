export function statistics(values) {
  if (!values.length) return { mean: 0, p95: 0, p99: 0, max: 0, samples: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return { mean, p95: sorted[Math.ceil(sorted.length * .95) - 1], p99: sorted[Math.ceil(sorted.length * .99) - 1], max: sorted.at(-1), samples: values.length };
}

export function summarize(values){const result=statistics(values);return {...result,fps:result.mean?1000/result.mean:0};}

export const profileEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('profile');
export const frameCosts = { physics: 0, animation: 0 };
