import { memo, useEffect, useMemo } from 'react';
import { RoundedBox, useTexture, MeshReflectorMaterial } from '@react-three/drei';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import StaticBatch from './StaticBatch';

export type V3 = [number, number, number];
export const palette = { cream: '#FFF8E1', blue: '#001D89', green: '#56D867', chrome: '#bac0bd', black: '#090c13' };

export function Enamel({ color, metal = .14, rough = .46, emissive }: { color: string; metal?: number; rough?: number; emissive?: string }) {
  const map = useTexture('/textures/enamel-wear.png');
  map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return <meshPhysicalMaterial color={color} map={map} bumpMap={map} bumpScale={.008} roughnessMap={map} metalness={metal} roughness={rough} clearcoat={.14} clearcoatRoughness={.4} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? .4 : 0} envMapIntensity={.45} />;
}

export function Block({ size, position = [0, 0, 0], color = palette.blue, radius = .04, metal = .14, rough = .46, rotation, emissive, worn = true }: {
  size: V3; position?: V3; color?: string; radius?: number; metal?: number; rough?: number; rotation?: V3; emissive?: string; worn?: boolean;
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => new RoundedBoxGeometry(width, height, depth, 3, Math.max(.001, Math.min(radius, Math.min(width, height, depth) / 2 - .001))), [width, height, depth, radius]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} position={position} rotation={rotation} castShadow receiveShadow>
    {worn ? <Enamel color={color} metal={metal} rough={rough} emissive={emissive} /> : <meshPhysicalMaterial color={color} metalness={metal} roughness={rough} clearcoat={.4} emissive={emissive ?? '#000000'} emissiveIntensity={emissive ? 1 : 0} />}
  </mesh>;
}

export function Cylinder({ position, radius = .1, height = .1, color = palette.chrome, rotation, emissive, metal = .85 }: { position: V3; radius?: number; height?: number; color?: string; rotation?: V3; emissive?: string; metal?: number }) {
  return <mesh position={position} rotation={rotation} userData={{pegaCylinder:{radius,height}}} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 24]} /><meshPhysicalMaterial color={color} roughness={.25} metalness={metal} clearcoat={.4} emissive={emissive || '#000000'} emissiveIntensity={emissive ? .9 : 0} /></mesh>;
}

function Screw({ position, rotation = [Math.PI / 2, 0, 0] }: { position: V3; rotation?: V3 }) {
  return <group position={position} rotation={rotation}>
    <Cylinder position={[0, 0, 0]} radius={.029} height={.012} color="#6d706b" />
    <Block size={[.034, .005, .006]} position={[0, .007, 0]} color="#161a19" radius={.001} worn={false} />
  </group>;
}

export function Glass({ position, rotation = [0, 0, 0], size }: { position: V3; rotation?: V3; size: [number, number] }) {
  const map = useTexture('/textures/enamel-wear.png');
  return <mesh position={position} rotation={rotation} renderOrder={8}>
    <planeGeometry args={size} />
    <meshPhysicalMaterial color="#e1eced" map={map} metalness={.08} roughness={.14} bumpMap={map} bumpScale={.002} clearcoat={1} clearcoatRoughness={.12} transparent opacity={.12} envMapIntensity={.8} side={THREE.DoubleSide} depthWrite={false} />
  </mesh>;
}

function Mirror({ position, size, rotation, reflect = false }: { position: V3; size: [number, number]; rotation?: V3; reflect?: boolean }) {
  const backdrop = useTexture('/textures/poster-wall.png'); backdrop.colorSpace = THREE.SRGBColorSpace;
  return <mesh position={position} rotation={rotation} receiveShadow><planeGeometry args={size} />{reflect ? <MeshReflectorMaterial map={backdrop} resolution={256} blur={[12,12]} mixBlur={.5} mirror={.55} mixStrength={.65} color="#938570" metalness={.55} roughness={.23} /> : <meshStandardMaterial color="#949c8b" roughness={.27} metalness={.75} envMapIntensity={.5} />}</mesh>;
}

export const Cabinet = memo(function Cabinet() {
  const cream = palette.cream;
  const poster = useTexture('/textures/poster-wall.png'); poster.colorSpace = THREE.SRGBColorSpace;
  return <group>
    <Block size={[3.86, .16, 2.78]} position={[0, .12, 0]} color="#101321" radius={.08} />
    <Block size={[3.72, 1.93, .13]} position={[0, 1.1, -1.27]} color={palette.blue} radius={.05} />
    {[-1,1].map(side => <group key={`base-${side}`}>
      <Block size={[.17,1.93,2.59]} position={[side*1.77,1.1,-.06]} color={palette.blue} radius={.06} />
      <Block size={[1.10,1.52,.12]} position={[side*1.29,1.07,1.28]} color={palette.blue} radius={.025} />
    </group>)}
    <Block size={[3.7,.40,.13]} position={[0,1.86,1.28]} color={palette.blue} radius={.025} />
    <Block size={[1.46,.75,.13]} position={[0,1.4,1.28]} color={palette.blue} radius={.025} />
    <Block size={[1.46,.16,.13]} position={[0,.23,1.28]} color={palette.blue} radius={.025} />
    <Block size={[3.78, .12, 2.66]} position={[0, .25, -.03]} color="#111a28" radius={.025} />
    {[-1, 1].map(side => <group key={side}>
      <Block size={[.18, 3.28, 2.63]} position={[side * 1.77, 3.64, -.02]} color={cream} radius={.08} />
      <Mirror size={[2.34, 3.18]} position={[side * 1.67, 3.67, -.03]} rotation={[0, side * -Math.PI / 2, 0]} />
      <Block size={[.075, 3.26, .16]} position={[side * 1.65, 3.66, 1.30]} color="#a1a292" metal={.45} radius={.024} rough={.4} />
      <Block size={[.07, 3.17, .035]} position={[side * 1.56, 3.67, 1.315]} color="#222825" radius={.012} worn={false} />
      <Block size={[.22, 3.22, .17]} position={[side * 1.77, 3.65, 1.34]} color={cream} radius={.052} />
      {[2.17, 2.9, 4.2, 4.84].map(y => <Screw key={y} position={[side * 1.77, y, 1.431]} />)}
      <Block size={[.13, 1.9, .18]} position={[side * 1.8, 1.09, 1.27]} color={cream} radius={.055} />
      {[-.93, .9].map(z => <Cylinder key={z} position={[side * 1.49, .1, z]} radius={.13} height={.17} color="#111315" />)}
    </group>)}
    <mesh position={[1.866,3.62,-.02]} rotation={[0,Math.PI/2,0]}><planeGeometry args={[2.39,3.04]} /><meshStandardMaterial map={poster} roughness={.8} color="#a6a09b" /></mesh>
    <Block size={[3.58, .13, 2.52]} position={[0, 5.23, 0]} color={cream} />
    <Block size={[3.53, 3.10, .1]} position={[0, 3.68, -1.27]} color={cream} />
    <Mirror size={[3.28, 2.95]} position={[0, 3.67, -1.208]} reflect />
    <Block size={[2.71, .14, 2.55]} position={[-.42, 2.05, 0]} color="#b0b8a5" rough={.48} />
    <Block size={[.84, .14, 1.57]} position={[1.355, 2.05, -.49]} color="#b0b8a5" />
    <Block size={[.84, .14, .22]} position={[1.355, 2.05, 1.165]} color="#b0b8a5" />
    <Block size={[3.59, .15, .21]} position={[0, 2.11, 1.28]} color={cream} radius={.035} />
    <Block size={[3.29, .035, .035]} position={[0, 2.205, 1.34]} color="#807e6e" metal={.8} radius={.005} />
    <Glass position={[0, 3.69, 1.345]} size={[3.12, 2.93]} />
    <Block size={[3.89, .84, 2.79]} position={[0, 5.68, 0]} color={cream} radius={.15} />
    <Block size={[3.62, .68, .045]} position={[0, 5.68, 1.413]} color="#353b32" radius={.105} metal={.7} />
    <RoundedBox args={[3.48,.56,.055]} position={[0,5.69,1.446]} radius={.07} smoothness={3}><meshPhysicalMaterial color="#188d2b" emissive="#00b820" emissiveIntensity={.8} roughness={.4} clearcoat={.25} envMapIntensity={.1} toneMapped={false} /></RoundedBox>
    {[5.475, 5.515].map(y => <Block key={y} size={[3.4, .018, .008]} position={[0, y, 1.478]} color={cream} radius={.001} worn={false} />)}
    {[-1.8, 1.8].flatMap(x => [5.36, 5.98].map(y => <Screw key={`${x}-${y}`} position={[x, y, 1.423]} />))}
    <Block size={[2.72, .035, .18]} position={[0, 5.115, .66]} color="#fff1c4" emissive="#fff2c8" worn={false} radius={.01} />
    <Block size={[2.72, .035, .14]} position={[0, 5.115, -.69]} color="#fff1c4" emissive="#fff2c8" worn={false} radius={.01} />
    <group position={[0, 1.97, 1.5]} rotation={[.17, 0, 0]}>
      <Block size={[3.94, .23, .99]} color={cream} radius={.14} rough={.36} />
      <Block size={[3.69, .025, .80]} position={[0, .126, -.01]} color={palette.green} radius={.11} />
      <Block size={[3.58, .028, .69]} position={[0, .144, -.01]} color={cream} radius={.085} rough={.32} />
      {[-1.62, 1.62].flatMap(x => [-.24, .26].map(z => <Screw key={`${x}-${z}`} position={[x, .166, z]} rotation={[0, 0, 0]} />))}
    </group>
    <Cylinder position={[-.67, 2.15, 1.52]} radius={.2} height={.04} color="#242620" />
    <Cylinder position={[-.67, 2.175, 1.52]} radius={.15} height={.04} color="#31342b" />
    <Cylinder position={[.58, 2.14, 1.53]} radius={.205} height={.055} color="#23251f" />
    <Cylinder position={[.58, 2.18, 1.53]} radius={.172} height={.027} color="#bbc1aa" />
    <Block size={[.53, .76, .07]} position={[.56, 1.31, 1.297]} color="#0b101f" radius={.018} />
    <Block size={[.46, .69, .035]} position={[.56, 1.31, 1.342]} color="#a9aca3" radius={.025} metal={.9} rough={.33} />
    <Block size={[.075, .3, .022]} position={[.56, 1.39, 1.369]} color="#111719" radius={.004} />
    {[-.18,.18].flatMap(x => [-.27,.27].map(y => <Screw key={`${x}-${y}`} position={[.56+x,1.31+y,1.37]} />))}
    <Cylinder position={[.56, 1.07, 1.372]} rotation={[Math.PI/2,0,0]} radius={.05} height={.017} color="#373b3a" />
    <Block size={[1.31, .66, .08]} position={[0, .65, .86]} color="#0c1115" radius={.025} />
    <Block size={[1.45, .075, .63]} position={[0, .28, 1.37]} color={cream} radius={.025} />
    {[-1,1].map(side => <Block key={`exit-${side}`} size={[.075,.69,.15]} position={[side*.70,.66,1.35]} color="#707b73" metal={.8} rough={.3} radius={.02} />)}
    <Block size={[1.45,.075,.15]} position={[0,1.02,1.35]} color="#707b73" metal={.8} radius={.025} />
    {Array.from({length:6}, (_,row) => Array.from({length:7},(_,col) => <mesh key={`${row}-${col}`} position={[-1.36+col*.073,1.29+row*.068,1.292]}><circleGeometry args={[.019,8]} /><meshBasicMaterial color="#080e1e" /></mesh>))}
    <mesh position={[1.3, 2.19, .72]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.31, .026, 10, 36]} /><meshStandardMaterial color="#828b7b" metalness={.82} roughness={.3} /></mesh>
  </group>;
});

function Arcade({ position, rotation = 0, right = false }: { position: V3; rotation?: number; right?: boolean }) {
  const stickers = useTexture('/textures/poster-wall.png'); stickers.colorSpace = THREE.SRGBColorSpace;
  const screen = useTexture(right ? '/textures/arcade-space-screen.png' : '/textures/arcade-screen.png'); screen.colorSpace = THREE.SRGBColorSpace;
  const shape = useMemo(() => new THREE.Shape([
    new THREE.Vector2(-1.15, 0), new THREE.Vector2(-1.15, 1.65), new THREE.Vector2(-1.68, 1.99), new THREE.Vector2(-1.55, 2.30), new THREE.Vector2(-.94, 2.52), new THREE.Vector2(-.71, 5.23), new THREE.Vector2(-.98, 5.67), new THREE.Vector2(-.54, 6.06), new THREE.Vector2(1.02, 6.06), new THREE.Vector2(1.02, 0)
  ]), []);
  return <StaticBatch cacheView><group position={position} rotation={[0, rotation, 0]} scale={[1,1.1,1]}>
    <Block size={[2.53, 5.85, 1.8]} position={[0,2.94,-.13]} color="#07111c" />
    {[-1.22,1.22].map(x => <mesh key={x} position={[x-.045,0,0]} rotation={[0,Math.PI/2,0]} castShadow receiveShadow><extrudeGeometry args={[shape,{depth:.10,bevelEnabled:true,bevelSize:.035,bevelThickness:.025,bevelSegments:2,steps:1}]} /><Enamel color="#095ca0" rough={.31} metal={.48} /></mesh>)}
    <mesh position={[right ? -1.29 : 1.29,3.65,.65]} rotation={[0,right ? -Math.PI/2 : Math.PI/2,0]}><planeGeometry args={[.46,3.9]} /><meshStandardMaterial map={stickers} color="#6b7d86" roughness={.8} /></mesh>
    <mesh position={[0,2.65,1.11]}><planeGeometry args={[2.22,.19]} /><meshStandardMaterial map={stickers} color="#8a9a9c" roughness={.7} /></mesh>
    <Block size={[2.40,.57,.3]} position={[0,5.65,.72]} color="#101624" radius={.08} />
    <Block size={[2.17,.37,.035]} position={[0,5.65,.89]} color={right ? '#ec4985' : '#45cbec'} emissive={right ? '#ec4985' : '#45cbec'} radius={.025} worn={false} />
    <group position={[0,3.84,1.01]} rotation={[-.12,0,0]}>
      <Block size={[2.37,2.38,.16]} color="#090b13" radius={.1} />
      <RoundedBox args={[2.18,1.88,.095]} radius={.12} smoothness={4} position={[0,0,.11]}><meshStandardMaterial color="#080b1c" roughness={.2} /></RoundedBox>
      <mesh position={[0,0,.165]}><planeGeometry args={[2.06,1.76]} /><meshBasicMaterial map={screen} color={right ? '#c0d2ff' : '#ffffff'} toneMapped={false} /></mesh>
      <Glass position={[0,0,.17]} size={[2.1,1.8]} />
    </group>
    <group position={[0,2.22,1.17]} rotation={[.18,0,0]}>
      <Block size={[2.54,.17,1.00]} color="#075190" radius={.05} />
      <Block size={[2.35,.024,.84]} position={[0,.105,0]} color="#10253b" radius={.03} />
      <Cylinder position={[-.72,.19,.13]} radius={.18} height={.04} color="#0c1220" />
      <Cylinder position={[-.72,.32,.13]} radius={.04} height={.23} />
      <mesh position={[-.72,.49,.13]}><sphereGeometry args={[.135,24,16]} /><meshPhysicalMaterial color="#e92c80" roughness={.19} clearcoat={1} /></mesh>
      {[0,1,2,3,4,5].map(i => <Cylinder key={i} position={[.10+(i%3)*.29,.18,Math.floor(i/3)*.29-.07]} radius={.115} height={.075} color={right ? '#55c38a' : '#df287b'} metal={.15} />)}
    </group>
    <Block size={[2.38,1.7,.15]} position={[0,1.05,1.16]} color="#0b1521" />
    <Block size={[.48,.79,.1]} position={[.33,1.10,1.27]} color="#757b79" metal={.95} />
    <Block size={[.065,.32,.025]} position={[.33,1.23,1.334]} color="#070e12" />
    <Block size={[.3,.13,.035]} position={[.33,.88,1.339]} color="#0c1319" />
    <pointLight position={[0,3.8,1.6]} color={right ? '#9850ff' : '#197cff'} intensity={5} distance={3} />
  </group></StaticBatch>;
}

export const ArcadeRoom = memo(function ArcadeRoom() {
  const neon = useTexture('/textures/neon-game-sign.png'); neon.colorSpace=THREE.SRGBColorSpace;
  const wall = useTexture('/textures/poster-wall.png'); wall.colorSpace=THREE.SRGBColorSpace; wall.anisotropy=4;
  return <group userData={{staticScenery:true,staticArcade:true}}>
    <mesh position={[0,3.3,-3.2]} receiveShadow><planeGeometry args={[16,9]} /><meshStandardMaterial map={wall} color="#9a91a5" roughness={.94} /></mesh>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.015,0]} receiveShadow><planeGeometry args={[28,25]} /><MeshReflectorMaterial resolution={256} blur={[220,100]} mixBlur={1} mirror={.16} mixStrength={.65} depthScale={.3} minDepthThreshold={.5} maxDepthThreshold={1.5} color="#171c2b" metalness={.58} roughness={.38} /></mesh>
    <mesh position={[-5.05,3.85,-2.91]}><planeGeometry args={[.59,1.77]} /><meshBasicMaterial map={neon} toneMapped={false} /></mesh>
    <Arcade position={[-4.90,0,1.15]} rotation={.17} />
    <Arcade position={[4.28,0,1.0]} rotation={-.18} right />
    {[-1,1].map(side => <group key={side}>
      <Block size={[.075,6.7,.11]} position={[side*5.8,3.3,-2.96]} color="#252838" radius={.015} />
      <Block size={[2.2,.065,.075]} position={[side*3.4,5.5,-2.98]} rotation={[0,0,side*.06]} color="#31aaff" emissive="#168aff" worn={false} radius={.02} />
      <pointLight position={[side*3.4,5.3,-2.55]} color="#087aff" intensity={37} distance={7} />
      {side > 0 && <Block size={[.07,2.1,.08]} position={[side*2.68,3.9,-2.95]} color="#ff51bd" emissive="#ff319e" worn={false} radius={.02} />}
      <pointLight position={[side*2.65,3.9,-2.65]} color="#ff3099" intensity={20} distance={5} />
    </group>)}
    <Cylinder position={[-2.36,1.09,-1.7]} radius={.33} height={.11} color="#a83061" metal={.2} />
    <Cylinder position={[-2.36,.55,-1.7]} radius={.045} height={1.0} color="#777a81" />
    <Cylinder position={[-2.36,.07,-1.7]} radius={.34} height={.05} color="#444953" />
  </group>;
});
