'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { CANDLE_X, CANDLE_Z, FLAME_Y, LIGHT_GAIN } from './sceneConstants';

const CANDLE_LIGHT = new THREE.Vector3(CANDLE_X - 0.015, FLAME_Y + 0.01, CANDLE_Z + 0.01);
const BASE_INTENSITY = 1.1;

/** Candle light that flickers, a warm key, a rim from behind and a faint sick green fill. */
export function Lights() {
  const reducedMotion = usePrefersReducedMotion();
  const candle = useRef<THREE.PointLight>(null);
  const keyTarget = useMemo(() => {
    const target = new THREE.Object3D();
    target.position.set(0, 0.04, 0.02);
    return target;
  }, []);

  useFrame(({ clock }) => {
    const light = candle.current;
    if (reducedMotion || !light) return;
    const t = clock.elapsedTime;
    const noise = Math.sin(t * 9.1) * 0.04 + Math.sin(t * 23.7) * 0.03 + Math.sin(t * 3.3) * 0.03;
    light.intensity = THREE.MathUtils.clamp(BASE_INTENSITY + noise, 0.6, 1.5) * LIGHT_GAIN;
    light.position.set(
      CANDLE_LIGHT.x + Math.sin(t * 5.1) * 0.0015,
      CANDLE_LIGHT.y + Math.sin(t * 7.3) * 0.001,
      CANDLE_LIGHT.z + Math.sin(t * 4.3) * 0.0015,
    );
  });

  return (
    <>
      <pointLight
        ref={candle}
        color="#ff9a40"
        intensity={BASE_INTENSITY * LIGHT_GAIN}
        distance={2.5}
        decay={2}
        position={CANDLE_LIGHT}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-radius={4}
      />
      <primitive object={keyTarget} />
      <spotLight
        color="#ffae6a"
        intensity={0.9 * LIGHT_GAIN}
        distance={2}
        angle={0.45}
        penumbra={0.9}
        decay={2}
        position={[0.12, 0.32, 0.5]}
        target={keyTarget}
      />
      <pointLight
        color="#ff7a30"
        intensity={0.7 * LIGHT_GAIN}
        distance={1.4}
        decay={2}
        position={[-0.12, 0.16, -0.3]}
      />
      <directionalLight color="#4f8a72" intensity={0.18 * LIGHT_GAIN} position={[-1, 0.5, 0.3]} />
    </>
  );
}
