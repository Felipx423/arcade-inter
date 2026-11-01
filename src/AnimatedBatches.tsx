import {useLayoutEffect,useRef} from 'react';
import {useFrame,useThree} from '@react-three/fiber';
import {createAnimatedBatches,createTransparentInstances} from './animated-batching';

export default function AnimatedBatches({revision}:{revision:number}){
  const {scene}=useThree(),token=useRef(0);
  useFrame(()=>{token.current++;},-10);
  useLayoutEffect(()=>{
    const state=createAnimatedBatches(scene);
    const transparentState=createTransparentInstances(scene);
    let last=-1;
    const sync=()=>{
      if(last!==token.current){
        last=token.current;
        state.update();
        transparentState.update(false);
      }
    };
    for(const batch of [...state.batches,...transparentState.instances]){
      const beforeRender=batch.onBeforeRender;
      const beforeShadow=batch.onBeforeShadow;
      batch.onBeforeRender=function(...args){sync();beforeRender.apply(this,args);};
      batch.onBeforeShadow=function(...args){sync();beforeShadow.apply(this,args);};
    }
    return ()=>{transparentState.dispose();state.dispose();};
  },[scene,revision]);
  return null;
}
