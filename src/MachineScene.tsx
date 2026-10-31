import { installTransmissionRegion } from './transmission';
import { useShaderWarmup } from './useShaderWarmup';
import { createCapsuleAssets, type CapsuleAssets } from './capsule-assets';
import { installStaticViews } from './static-view';
import { installStaticShadows } from './static-shadows';
import DynamicCylinders from './DynamicCylinders';
import AnimatedBatches from './AnimatedBatches';
import { optimizeDirectLighting } from './lighting';
import StaticBatch from './StaticBatch';
import PerformancePanel from './PerformancePanel';
import { profileEnabled, frameCosts } from './performance.mjs';
import { prefersReducedMotion } from './motion';
import { Component, Suspense, memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { ArcadeRoom, Block, Cabinet, Cylinder, type V3 } from './SceneObjects';
import { capsulePositions, ease, mix, nearestCapsule } from './controller';
import type { Aim, Capture, CapsulePose, DrawResult } from './types';
import { advanceWorld, createBall, createWorld, FLOOR_Y, kickBall, type BallWorld } from './physics';

const colors = ['#001D89', '#56D867', '#FFF8E1', '#dce9d3'];
const chrome = '#c6cac5';
const mint = '#56D867';
function usePhotoTexture(blob: Blob | undefined) {
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  useEffect(() => {
    setTexture(null);
    if (!blob) return;
    let cancelled = false; let map: THREE.CanvasTexture | null = null;
    const url = URL.createObjectURL(blob); const image = new Image();
    image.onload = () => {
      if (cancelled) return;
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 512;
      const context = canvas.getContext('2d')!; context.fillStyle = '#faf6f1'; context.fillRect(0, 0, 512, 512);
      const scale = Math.min(460 / image.naturalWidth, 460 / image.naturalHeight);
      context.drawImage(image, (512 - image.naturalWidth * scale) / 2, (512 - image.naturalHeight * scale) / 2, image.naturalWidth * scale, image.naturalHeight * scale);
      map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 4; setTexture(map);
    };
    image.src = url;
    return () => { cancelled = true; URL.revokeObjectURL(url); map?.dispose(); };
  }, [blob]);
  return texture;
}

function Capsule({ color, topRef, assets }: { color: string; topRef?: React.RefObject<THREE.Group | null>; assets: CapsuleAssets }) {
  return <group>
    <mesh castShadow receiveShadow geometry={assets.lower} material={assets.bottom} dispose={null} />
    <group ref={topRef} position={[0, 0, -.25]}>
      <mesh position={[0, 0, .25]} castShadow geometry={assets.upper} material={assets.tops.get(color)} dispose={null} />
    </group>
    <mesh rotation={[Math.PI / 2, 0, 0]} geometry={assets.band} material={assets.seam} dispose={null} />
  </group>;
}

interface SceneProps {
  total: number; aim: Aim; capture: Capture | null; result: DrawResult | null;
  interactive: boolean; canGrab: boolean;
  onAim: (aim: Aim) => void; onGrab: () => void; onDelivered: () => void;
  onPositions: (poses: CapsulePose[]) => void;
  onReady: () => void; onUnavailable: () => void; onStatus: (value: string) => void;
}

const SceneEnvironment = memo(function SceneEnvironment() {
  return (    <Environment resolution={128} frames={1}>
      <Lightformer intensity={3} color="#fff0ce" position={[0, 5, 2.5]} scale={[3, .25, 1]} />
      <Lightformer intensity={1.5} color="#b2d7ff" position={[-4, 4, 2]} rotation={[0, Math.PI / 3, 0]} scale={[1, 6, 1]} />
      <Lightformer intensity={1.2} color="#dd8ada" position={[5, 3, -1]} rotation={[0, -Math.PI / 2, 0]} scale={[1, 5, 1]} />
      <Lightformer intensity={.7} color="#c9d3dc" position={[0, 2, 6]} scale={[4, 4, 1]} />
    </Environment>);
});

function CameraFit() {
  const { camera, size, invalidate } = useThree();
  useEffect(() => {
    const c = camera as THREE.PerspectiveCamera;
    const mobile = size.width / size.height < .85;
    c.fov = 42;
    c.position.set(mobile ? .32 : 2.5, mobile ? 4.0 : 4.05, mobile ? 11.9 : 8.1);
    c.lookAt(mobile ? 0 : -.65, mobile ? 3.12 : 3.25, 0);
    c.updateProjectionMatrix(); invalidate();
  }, [camera, size.width, size.height, invalidate]);
  return null;
}

function World(props: SceneProps) {
  const { invalidate, gl, size, scene } = useThree();
  const renderReady=useShaderWarmup(props.onReady, props.onUnavailable);
  const capsuleAssets=useMemo(()=>createCapsuleAssets(colors),[]);
  useEffect(()=>()=>capsuleAssets.dispose(),[capsuleAssets]);
  const shadowSize = size.width < 600 ? 1024 : 2048;
  useEffect(() => installTransmissionRegion(gl), [gl]);
  const claw = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Group>(null);
  const carriage = useRef<THREE.Group>(null);
  const pool = useRef<THREE.Group>(null);
  const movingCapsule = useRef<THREE.Group>(null);
  const movingTop = useRef<THREE.Group>(null);
  const card = useRef<THREE.Group>(null);
  const selection = useRef<THREE.Mesh>(null);
  const joystick = useRef<THREE.Group>(null);
  const grabButton = useRef<THREE.Group>(null);
  const fingers = useRef<(THREE.Group | null)[]>([]);
  const lastCapture = useRef('');
  const elapsed = useRef(0);
  const delivered = useRef(false);
  const lastStatus = useRef('');
  const idle = useRef(new THREE.Vector3(0, 4.65, 0));
  const idleTarget=useRef(new THREE.Vector3());
  const drag = useRef<{ x: number; y: number; aim: Aim } | null>(null);
  const capsuleCount = Math.min(12, props.capture?.count ?? props.total);
  const positions = useMemo(() => capsulePositions(capsuleCount), [capsuleCount]);
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);
  const previousWorld = useRef<BallWorld | null>(null);
  const world = useMemo(() => {
    const next = createWorld(positions, reducedMotion);
    const survivors = previousWorld.current?.balls.filter(b => !b.hidden) ?? [];
    next.balls = next.balls.map((spawn, i) => survivors[i] ? { ...survivors[i] } : spawn);
    previousWorld.current = next;
    return next;
  }, [positions, reducedMotion]);
  const poseBuffer=useMemo(()=>world.balls.map(({x,y,z})=>({x,y,z})),[world]);
  useEffect(() => {
    const seen = new Set<THREE.Material>(); const restore: (() => void)[] = [];
    scene.traverse(object => { const m = (object as THREE.Mesh).material; for (const material of Array.isArray(m) ? m : m ? [m] : []) { if (material instanceof THREE.MeshStandardMaterial && !seen.has(material)) { seen.add(material); restore.push(optimizeDirectLighting(material)); } } });
    invalidate(); return () => restore.forEach(fn => fn());
  }, [scene, capsuleCount, invalidate]);
  useEffect(()=>installStaticShadows(gl,scene),[gl,scene]);
  useEffect(()=>installStaticViews(gl,scene,invalidate),[gl,scene,invalidate]);
  const photo = usePhotoTexture(props.capture?.result.photo || props.result?.photo);
  const chosenColor = useRef(colors[0]);
  const fingerGeometry = useMemo(() => new THREE.ExtrudeGeometry((() => { const s = new THREE.Shape(); s.moveTo(-.015,.01); s.lineTo(.022,.01); s.bezierCurveTo(.29,-.15,.40,-.38,.25,-.59); s.lineTo(.18,-.66); s.lineTo(.20,-.59); s.bezierCurveTo(.33,-.40,.26,-.19,-.015,.01); return s; })(), { depth: .036, bevelEnabled: true, bevelSize: .012, bevelThickness: .009, bevelSegments: 3, steps: 1 }), []);
  useEffect(() => () => fingerGeometry.dispose(), [fingerGeometry]);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); props.onUnavailable(); };
    gl.domElement.addEventListener('webglcontextlost', lost);
    return () => gl.domElement.removeEventListener('webglcontextlost', lost);
  }, [gl]);
  useEffect(() => { invalidate(); }, [photo, invalidate]);
  useEffect(() => { invalidate(); }, [world, invalidate]);
  useEffect(() => {
    if (!props.capture && props.result) {
      world.balls = world.balls.map((b, i) => b.hidden ? createBall(positions[i], i, reducedMotion) : b);
      world.awake = !reducedMotion && world.balls.length > 0; world.quiet = 0; invalidate();
    }
  }, [props.capture, props.result, positions, world, reducedMotion, invalidate]);

  useFrame((_, delta) => {
    const animationStart = profileEnabled ? performance.now() : 0;
    const dt = Math.min(delta, .05);
    let cx = props.aim.x; let cz = props.aim.z; let cy = 4.65; let grip = 0; let held = false; let open = 0; let showCard = false;
    let capsulePos: V3 = [0, .54, 1.57];
    if (props.capture) {
      const c = props.capture;
      const isNew = lastCapture.current !== c.id;
      if (isNew) {
        lastCapture.current = c.id; elapsed.current = 0; delivered.current = false; chosenColor.current = colors[world.balls[c.targetIndex]?.colorIndex ?? c.targetIndex % colors.length];
        const ball = world.balls[c.targetIndex];
        if (ball) { ball.x = c.target.x; ball.z = c.target.z; ball.y = c.targetY ?? FLOOR_Y; ball.vx = ball.vy = ball.vz = 0; }
      }
      elapsed.current += isNew ? 0 : delta;
      const t = props.capture.reduced ? 1 : Math.min(1, elapsed.current / 5.2);
      const p = c.target;
      const captureHeight = (c.targetY ?? FLOOR_Y) + .91;
      cx = mix(props.aim.x, p.x, t / .12); cz = mix(props.aim.z, p.z, t / .12);
      if (t > .12 && t <= .32) cy = mix(4.65, captureHeight, (t - .12) / .20);
      else if (t > .32 && t <= .42) { cy = captureHeight; grip = ease((t - .32) / .10); }
      else if (t > .42 && t <= .60) { cy = mix(captureHeight, 4.65, (t - .42) / .18); grip = 1; held = true; }
      else if (t > .60 && t <= .74) { cx = mix(p.x, 1.3, (t - .60) / .14); cz = mix(p.z, .72, (t - .60) / .14); grip = 1; held = true; }
      else if (t > .74 && t <= .80) { cx = 1.3; cz = .72; cy = mix(4.65, 3.32, (t - .74) / .06); grip = 1; held = true; }
      else if (t > .80) {
        grip = 1 - ease((t - .80) / .04);
        cx = mix(1.3, 0, (t - .80) / .20); cz = mix(.72, -.4, (t - .80) / .20); cy = mix(3.32, 4.65, (t - .80) / .20);
        if (t <= .87) capsulePos = [1.3, mix(2.41, .55, (t - .80) / .07), .72];
        else capsulePos = [mix(1.3, 0, (t - .87) / .07), .54, mix(.72, 1.57, (t - .87) / .07)];
      }
      if (held) capsulePos = [cx, cy - .91, cz];
      open = ease((t - .94) / .06); showCard = t > .95;
      movingCapsule.current!.visible = t > .42;
      const selected = world.balls[c.targetIndex];
      if (selected) selected.hidden = t > .42;
      if (movingCapsule.current && selected) {
        const blend = 1 - ease((t - .42) / .25);
        movingCapsule.current.rotation.set(selected.rx * blend, selected.ry * blend, selected.rz * blend);
      }
      const status = t < .12 ? 'Ajustando a mira…' : t < .42 ? 'A garra está descendo…' : t < .74 ? 'Pegou! Levando sua surpresa…' : t < .94 ? 'Uma surpresa chegando à saída…' : 'Vamos descobrir seu brinde!';
      if (status !== lastStatus.current) { lastStatus.current = status; props.onStatus(status); }
      if (t >= 1 && !delivered.current) { delivered.current = true; props.onDelivered(); }
      invalidate();
      idle.current.set(cx, cy, cz);
    } else {
      const target = idleTarget.current.set(props.result?0:props.aim.x,4.65,props.result?-.4:props.aim.z);
      idle.current.lerp(target, 1 - Math.exp(-dt * 13));
      cx = idle.current.x; cy = idle.current.y; cz = idle.current.z;
      if (idle.current.distanceTo(target) > .001) invalidate();
      movingCapsule.current!.visible = Boolean(props.result); open = props.result ? 1 : 0; showCard = Boolean(props.result);
      world.balls.forEach(ball => { ball.hidden = false; });
    }
    const obstacle = props.capture && cy < 3.85 ? { x: cx, y: cy - .66, z: cz, radius: .31 } : undefined;
    const physicsStart = profileEnabled ? performance.now() : 0;
    if (advanceWorld(world, delta, props.capture?.targetIndex ?? -1, obstacle)) invalidate();
    if (profileEnabled) frameCosts.physics = performance.now() - physicsStart;
    pool.current?.children.forEach((child, i) => {
      const ball = world.balls[i]; if (!ball) return;
      child.visible = !ball.hidden; child.position.set(ball.x, ball.y, ball.z); child.rotation.set(ball.rx, ball.ry, ball.rz);
    });
    world.balls.forEach((ball,i)=>{const pose=poseBuffer[i];pose.x=ball.x;pose.y=ball.y;pose.z=ball.z;});props.onPositions(poseBuffer);
    claw.current?.position.set(cx, cy, cz);
    carriage.current?.position.set(cx, 5.10, cz);
    if (cable.current) { const length = Math.max(.04, 5.10 - cy); cable.current.scale.y = length; cable.current.position.set(cx, cy + length / 2, cz); }
    fingers.current.forEach(finger => { if (finger) finger.rotation.z = -.24 * grip; });
    movingCapsule.current?.position.set(...capsulePos);
    if (movingTop.current) movingTop.current.rotation.x = -1.9 * open;
    if (card.current) { card.current.visible = showCard && Boolean(photo); card.current.position.set(0, mix(.52, 1.04, open), 1.72); card.current.scale.setScalar(.5 + open * .5); }
    if (joystick.current) { joystick.current.rotation.z = -props.aim.x * .22; joystick.current.rotation.x = props.aim.z * .30; }
    if (grabButton.current) grabButton.current.position.y = props.capture ? 2.19 : 2.23;
    if (selection.current) {
      const p = world.balls[nearestCapsule(world.balls, props.aim)];
      selection.current.visible = Boolean(p) && props.interactive && !props.result;
      if (p) selection.current.position.set(p.x, 2.135, p.z);
    }
    if (profileEnabled) frameCosts.animation = performance.now() - animationStart - frameCosts.physics;
  });

  const pointerStart = (e: ThreeEvent<PointerEvent>) => {
    if (!props.interactive) return;
    e.stopPropagation(); (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, aim: { ...props.aim } };
  };
  return <>
    <DynamicCylinders />
    <AnimatedBatches revision={capsuleCount} />
    {profileEnabled && <PerformancePanel ready={renderReady} onAim={props.onAim} onGrab={props.onGrab} capture={props.capture} canCapture={props.canGrab} onError={props.onUnavailable} />}
    <CameraFit />
    <color attach="background" args={['#080d1b']} />
    <fog attach="fog" args={['#080d1b', 11, 28]} />
    <ambientLight intensity={.18} color="#bbceef" />
    <hemisphereLight args={['#7ca5e0', '#191727', .55]} />
    <directionalLight position={[-3, 7, 6]} color="#87b8ff" intensity={.8} castShadow shadow-mapSize={[shadowSize, shadowSize]} shadow-camera-left={-7} shadow-camera-right={7} shadow-camera-top={8} shadow-camera-bottom={-2} shadow-normalBias={.018} shadow-bias={-.0002} />
    <directionalLight position={[0,6,4]} color="#ffe1a8" intensity={1.4} />
    <pointLight position={[0, 4.75, .63]} color="#ffcb79" intensity={24} distance={5} decay={2} />
    <pointLight position={[0, 4.6, -.7]} color="#ffe0a4" intensity={10} distance={4} decay={2} />
    <pointLight position={[-2.2, 3, 3]} color="#157bff" intensity={21} distance={7} />
    <pointLight position={[3, 3.6, 1]} color="#ff309b" intensity={10} distance={6} />
    <pointLight position={[0,5.9,1.7]} color="#56D867" intensity={2} distance={2.5} />
    <SceneEnvironment />
    <ArcadeRoom />
    <StaticBatch cacheView><Cabinet /></StaticBatch>
    {[-.93, .93].map(z => <group key={z}>
      <Block size={[3.22, .09, .13]} position={[0, 5.10, z]} color="#646c66" metal={.92} rough={.27} radius={.015} />
      <Cylinder position={[0, 5.16, z]} radius={.028} height={3.12} rotation={[0,0,Math.PI/2]} />
    </group>)}
    <group ref={carriage}>
      <Block size={[.14,.08,2.00]} color="#616b69" metal={.95} radius={.02} />
      <Block size={[.39,.20,.38]} position={[0,-.04,0]} color="#7a8177" metal={.8} radius={.035} />
      {[-.17,.17].map(x => <Cylinder key={x} position={[x,.04,0]} radius={.07} height={.07} rotation={[0,0,Math.PI/2]} color="#2b3130" />)}
    </group>
    <group ref={cable}>
      <mesh><cylinderGeometry args={[.017,.017,1,12]} /><meshStandardMaterial color="#333a36" roughness={.42} metalness={.65} /></mesh>
      <StaticBatch>{Array.from({length:18},(_,i) => <mesh key={i} position={[0,-.48+i*.055,0]} rotation={[Math.PI/2,0,0]}><torusGeometry args={[.042,.012,5,12]} /><meshStandardMaterial color="#262d29" roughness={.44} metalness={.6} /></mesh>)}</StaticBatch>
    </group>
    <group ref={claw} position={[0, 4.65, 0]}>
      <Cylinder position={[0,.04,0]} radius={.11} height={.30} color="#a8b1ab" />
      <Cylinder position={[0,-.11,0]} radius={.17} height={.09} />
      <Cylinder position={[0,.20,0]} radius={.13} height={.045} color="#4e5753" />
      {[0,1,2].map(i => <group key={i} rotation={[0, i*Math.PI*2/3, 0]}>
        <Cylinder position={[.093,.015,0]} radius={.021} height={.25} />
        <group ref={el => { fingers.current[i]=el; }} position={[.12,-.18,0]}>
          <mesh geometry={fingerGeometry} position={[0,0,-.018]} castShadow><meshPhysicalMaterial color={chrome} roughness={.12} metalness={.98} clearcoat={.25} /></mesh>
          <Cylinder position={[.01,-.01,0]} radius={.048} height={.09} rotation={[Math.PI/2,0,0]} color="#8d9690" />
          <Cylinder position={[.01,-.01,.05]} radius={.019} height={.009} rotation={[Math.PI/2,0,0]} color="#444f47" />
        </group>
      </group>)}
    </group>
    <group ref={pool}>
      {positions.map((_, i) => <group key={i}
        onClick={e => {
          if (!props.interactive || reducedMotion) return;
          e.stopPropagation();
          const b = world.balls[i];
          kickBall(world, i, (b.x - e.point.x) * 4 + .30, (b.z - e.point.z) * 4 - .25); invalidate();
        }}
        onPointerOver={() => { if (props.interactive) gl.domElement.style.cursor = 'pointer'; }}
        onPointerOut={() => { gl.domElement.style.cursor = ''; }}>
        <Capsule assets={capsuleAssets} color={colors[world.balls[i]?.colorIndex ?? i % colors.length]} />
      </group>)}
    </group>
    <mesh ref={selection} rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.29, .315, 40]} /><meshBasicMaterial color={mint} transparent opacity={.85} side={THREE.DoubleSide} toneMapped={false} /></mesh>
    <group ref={movingCapsule} visible={false} userData={{individualDraw:true}}><Capsule assets={capsuleAssets} color={chosenColor.current} topRef={movingTop} /></group>
    <group ref={card} visible={false} position={[0, 1.04, 1.72]}>
      <Block size={[.87, .78, .055]} color="#f5ede5" radius={.06} metal={.1} />
      {photo && <mesh position={[0, .025, .035]}><planeGeometry args={[.70, .70]} /><meshBasicMaterial map={photo} toneMapped={false} /></mesh>}
    </group>
    <group ref={joystick} position={[-.67, 2.16, 1.52]}
      onPointerDown={pointerStart}
      onPointerMove={e => { if (drag.current && props.interactive) { e.stopPropagation(); props.onAim({ x: drag.current.aim.x + (e.clientX - drag.current.x) * .012, z: drag.current.aim.z + (e.clientY - drag.current.y) * .012 }); } }}
      onPointerUp={e => { drag.current = null; (e.target as HTMLElement).releasePointerCapture(e.pointerId); }}
      onLostPointerCapture={() => { drag.current = null; }}
      onPointerOver={() => { if (props.interactive) gl.domElement.style.cursor = 'grab'; }} onPointerOut={() => { gl.domElement.style.cursor = ''; }}>
      <Cylinder position={[0, .17, 0]} radius={.045} height={.34} color={chrome} />
      <mesh position={[0, .36, 0]} castShadow><sphereGeometry args={[.14, 28, 20]} /><meshPhysicalMaterial color={mint} clearcoat={1} roughness={.2} metalness={.15} /></mesh>
      <mesh position={[0, .28, 0]}><sphereGeometry args={[.25, 12, 8]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
    </group>
    <group ref={grabButton} position={[.58, 2.23, 1.53]} onClick={e => { e.stopPropagation(); if (props.canGrab) props.onGrab(); }} onPointerOver={() => { if (props.canGrab) gl.domElement.style.cursor = 'pointer'; }} onPointerOut={() => { gl.domElement.style.cursor = ''; }}>
      <Cylinder position={[0, 0, 0]} radius={.145} height={.055} color={mint} emissive={mint} />
      <mesh position={[0,.025,0]} scale={[1,.28,1]}><sphereGeometry args={[.144,24,12]} /><meshPhysicalMaterial color={mint} emissive={mint} emissiveIntensity={.6} roughness={.16} clearcoat={1} /></mesh>
    </group>
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode; onError: () => void }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch() { this.props.onError(); }
  render() { return this.state.error ? <div className="webgl-message"><strong>O 3D não está disponível neste navegador.</strong><p>Ative a aceleração gráfica ou abra em um navegador compatível. Seus brindes continuam salvos e o cadastro está disponível.</p></div> : this.props.children; }
}

export default function MachineScene(props: SceneProps) {
  return <SceneBoundary onError={props.onUnavailable}>
    <Canvas shadows={{ type: THREE.PCFShadowMap }} frameloop="demand" dpr={[1, matchMedia('(max-width: 600px)').matches ? 1.25 : 1.5]} camera={{ position: [1.05, 3.9, 8.8], fov: 42, near: .1, far: 50 }} gl={{ antialias: true, alpha: false, powerPreference: 'high-performance', toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: .95 }}>
      <Suspense fallback={null}><World {...props} /></Suspense>
    </Canvas>
  </SceneBoundary>;
}


