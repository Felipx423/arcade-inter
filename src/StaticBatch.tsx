import { useLayoutEffect, useRef, type ReactNode } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { batchStaticMeshes } from './batching';

export default function StaticBatch({ children, cacheView=false }: { children: ReactNode; cacheView?:boolean }) {
  const root = useRef<THREE.Group>(null);
  const invalidate = useThree(state => state.invalidate);
  useLayoutEffect(() => {
    const batch = batchStaticMeshes(root.current!); invalidate();
    return () => batch.dispose();
  }, [invalidate]);
  return <group ref={root} userData={{staticScenery:true,staticArcade:cacheView}}>{children}</group>;
}
