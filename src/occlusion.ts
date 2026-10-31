import * as THREE from 'three';

export type DepthGrid={width:number;height:number;tile:number;pixels:Uint8Array;sourceWidth:number;sourceHeight:number};
const bounds=new THREE.Box3(),point=new THREE.Vector4(),matrix=new THREE.Matrix4();

/** Reject only when the entire projected bounding box is behind fully covered static pixels. */
export function isOccluded(mesh:THREE.Mesh,camera:THREE.Camera,grid:DepthGrid){
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox();
  bounds.copy(mesh.geometry.boundingBox!).applyMatrix4(mesh.matrixWorld);
  matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  let left=Infinity,right=-Infinity,bottom=Infinity,top=-Infinity,nearest=1;
  for(let i=0;i<8;i++){
    point.set(i&1?bounds.max.x:bounds.min.x,i&2?bounds.max.y:bounds.min.y,i&4?bounds.max.z:bounds.min.z,1).applyMatrix4(matrix);
    if(point.w<=0 || point.z < -point.w)return false;
    const x=point.x/point.w,y=point.y/point.w,z=(point.z/point.w+1)*.5;
    left=Math.min(left,x);right=Math.max(right,x);bottom=Math.min(bottom,y);top=Math.max(top,y);nearest=Math.min(nearest,z);
  }
  const x0=Math.max(0,Math.floor(((left*.5+.5)*grid.sourceWidth-2)/grid.tile));
  const x1=Math.min(grid.width-1,Math.floor(((right*.5+.5)*grid.sourceWidth+2)/grid.tile));
  const y0=Math.max(0,Math.floor(((bottom*.5+.5)*grid.sourceHeight-2)/grid.tile));
  const y1=Math.min(grid.height-1,Math.floor(((top*.5+.5)*grid.sourceHeight+2)/grid.tile));
  if(x0>x1 || y0>y1)return false;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=(y*grid.width+x)*4;
    const farthest=(grid.pixels[i]*65536+grid.pixels[i+1]*256+grid.pixels[i+2])/16777215;
    if(nearest<=farthest+.0002)return false;
  }
  return true;
}

export async function readDepthGrid(gl:THREE.WebGLRenderer,source:THREE.WebGLRenderTarget):Promise<DepthGrid>{
  const tile=8,width=Math.ceil(source.width/tile),height=Math.ceil(source.height/tile);
  const material=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:false,uniforms:{sourceDepth:{value:source.depthTexture},sourceColor:{value:source.textures[0]},sourceSize:{value:new THREE.Vector2(source.width,source.height)}},vertexShader:'void main(){gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:`
    uniform sampler2D sourceDepth,sourceColor;
    uniform vec2 sourceSize;
    void main(){
      vec2 origin=floor(gl_FragCoord.xy)*8.0;
      float farthest=0.0;
      for(int y=0;y<8;y++)for(int x=0;x<8;x++){
        vec2 pixel=origin+vec2(float(x),float(y));
        if(any(greaterThanEqual(pixel,sourceSize))){farthest=1.0;continue;}
        vec2 uv=(pixel+0.5)/sourceSize;
        float coverage=texture2D(sourceColor,uv).a;
        farthest=max(farthest,coverage<0.99999?1.0:texture2D(sourceDepth,uv).r);
      }
      float packed=ceil(clamp(farthest,0.0,1.0)*16777215.0);
      gl_FragColor=vec4(floor(packed/65536.0),mod(floor(packed/256.0),256.0),mod(packed,256.0),255.0)/255.0;
    }`});
  const geometry=new THREE.PlaneGeometry(2,2),scene=new THREE.Scene(),camera=new THREE.Camera();
  scene.add(new THREE.Mesh(geometry,material));
  const target=new THREE.WebGLRenderTarget(width,height,{minFilter:THREE.NearestFilter,magFilter:THREE.NearestFilter,depthBuffer:false});
  const previous=gl.getRenderTarget(),autoClear=gl.autoClear;
  try{
    gl.autoClear=true;gl.setRenderTarget(target);
    try{gl.render(scene,camera);}finally{gl.setRenderTarget(previous);gl.autoClear=autoClear;}
    const pixels=new Uint8Array(width*height*4);
    await gl.readRenderTargetPixelsAsync(target,0,0,width,height,pixels);
    return {width,height,tile,pixels,sourceWidth:source.width,sourceHeight:source.height};
  }finally{geometry.dispose();material.dispose();target.dispose();}
}
