declare const __PEGA_QA_FULL_MOTION__: boolean;

export function prefersReducedMotion() {
  const fullMotionQA = typeof __PEGA_QA_FULL_MOTION__ !== 'undefined' && __PEGA_QA_FULL_MOTION__ && location.hostname==='127.0.0.1' && location.port==='4179';
  return !fullMotionQA && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
