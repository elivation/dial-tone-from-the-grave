'use client';

import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { seededRandom } from './noise';
import { CANDLE_X, CANDLE_Z, FLAME_Y } from './sceneConstants';
import { flameTexture, haloTexture } from './sceneTextures';

const FLAME_SIZE = { x: 0.011, y: 0.028 };

type Drip = { x: number; y: number; z: number; length: number; angle: number };

/** A stub of wax on a brass holder, with drips down one side and a small flame. */
export function Candle() {
  const reducedMotion = usePrefersReducedMotion();
  const flame = useRef<THREE.Sprite>(null);
  const flameMap = useMemo(() => flameTexture(), []);
  const haloMap = useMemo(() => haloTexture(), []);
  const wax = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0xe6d8b8,
        roughness: 0.55,
        emissive: 0x4a2006,
        emissiveIntensity: 0.55,
      }),
    [],
  );
  const drips = useMemo<Drip[]>(() => {
    const random = seededRandom(3);
    return Array.from({ length: 5 }, (_, i) => {
      const angle = (i / 5) * Math.PI * 2 + 0.4;
      const length = 0.012 + random() * 0.03;
      return {
        x: CANDLE_X + Math.cos(angle) * 0.0165,
        y: 0.122 - length / 2,
        z: CANDLE_Z + Math.sin(angle) * 0.0165,
        length,
        angle,
      };
    });
  }, []);

  useFrame(({ clock }) => {
    if (reducedMotion || !flame.current) return;
    const t = clock.elapsedTime;
    flame.current.scale.set(
      FLAME_SIZE.x * (1 + 0.06 * Math.sin(t * 23)),
      FLAME_SIZE.y * (1 + 0.1 * Math.sin(t * 17 + 1)),
      1,
    );
  });

  return (
    <group>
      <mesh position={[CANDLE_X, 0.067, CANDLE_Z]} material={wax}>
        <cylinderGeometry args={[0.017, 0.019, 0.11, 48]} />
      </mesh>
      {drips.map((d) => (
        <mesh
          key={d.angle}
          position={[d.x, d.y, d.z]}
          rotation-y={-d.angle}
          scale={[1, 1, 0.6]}
          material={wax}
        >
          <capsuleGeometry args={[0.0022, d.length, 4, 10]} />
        </mesh>
      ))}
      <mesh position={[CANDLE_X, 0.006, CANDLE_Z]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.012, 48]} />
        <meshStandardMaterial color={0x3a2a14} roughness={0.35} metalness={0.85} />
      </mesh>
      <mesh position={[CANDLE_X, FLAME_Y - 0.012, CANDLE_Z]}>
        <cylinderGeometry args={[0.0006, 0.0006, 0.006, 6]} />
        <meshBasicMaterial color={0x110804} />
      </mesh>
      <sprite
        ref={flame}
        position={[CANDLE_X, FLAME_Y, CANDLE_Z]}
        scale={[FLAME_SIZE.x, FLAME_SIZE.y, 1]}
      >
        <spriteMaterial map={flameMap} blending={THREE.AdditiveBlending} depthWrite={false} />
      </sprite>
      <sprite position={[CANDLE_X, FLAME_Y, CANDLE_Z]} scale={[0.09, 0.12, 1]}>
        <spriteMaterial
          map={haloMap}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          opacity={0.3}
        />
      </sprite>
    </group>
  );
}
