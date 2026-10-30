declare const __PEGA_QA_FULL_MOTION__: boolean;

export function prefersReducedMotion() {
  const fullMotionQA = typeof __PEGA_QA_FULL_MOTION__ !== 'undefined' && __PEGA_QA_FULL_MOTION__;
  return !fullMotionQA && matchMedia('(prefers-reduced-motion: reduce)').matches;
}
