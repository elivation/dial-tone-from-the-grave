'use client';

import { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CameraRig } from './CameraRig';
import { Candle } from './Candle';
import { Desk } from './Desk';
import { DimRoomEnvironment } from './DimRoomEnvironment';
import { DustMotes } from './DustMotes';
import { Effects } from './Effects';
import { Lights } from './Lights';
import { PhoneModel } from './PhoneModel';
import { Spider } from './Spider';

/** Mounts only once every asset has loaded, then waits for a frame to be drawn. */
function ReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!cancelled) onReady();
      });
    });
    return () => {
      cancelled = true;
    };
  }, [onReady]);
  return null;
}

/** The haunted desk: phone, candle, spider and dust, lit by one flame. */
export default function PhoneCanvas({ onReady }: { onReady: () => void }) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      scene={{ environmentIntensity: 0.08 }}
      camera={{ fov: 32, near: 0.005, far: 10, position: [-0.06, 0.2, 0.5] }}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <color attach="background" args={['#030202']} />
      <fogExp2 attach="fog" args={['#050302', 1.4]} />
      <CameraRig />
      <DimRoomEnvironment />
      <Lights />
      <Suspense fallback={null}>
        <Desk />
        <Candle />
        <PhoneModel />
        <Spider />
        <DustMotes />
        <ReadySignal onReady={onReady} />
      </Suspense>
      <Effects />
    </Canvas>
  );
}
