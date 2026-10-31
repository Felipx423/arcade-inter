import {useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {createAnimatedBatches} from './animated-batching';

export default function AnimatedBatches({revision}:{revision:number}){
  const {scene}=useThree(),token=useRef(0);
  useFrame(()=>{token.current++;},-10);
  useLayoutEffect(()=>{
    const state=createAnimatedBatches(scene);let last=-1;
    for(const batch of state.batches){
      const before=batch.onBeforeRender;
      batch.onBeforeRender=function(...args){if(last!==token.current){last=token.current;state.update();}before.apply(this,args);};
    }
    return ()=>state.dispose();
  },[scene,revision]);
  return null;
}
