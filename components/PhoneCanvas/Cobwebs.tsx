'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { strandSheen, webMotion, webSegments, type Vec3, type WebSpec } from './cobweb';
import { CANDLE_X, CANDLE_Z, FLAME_Y } from './sceneConstants';

const FLAME: Vec3 = [CANDLE_X, FLAME_Y, CANDLE_Z];
/** Where the web is fixed to the phone. The sheet and the loose strands all hang from here. */
const HUB: Vec3 = [0.12, 0.077, -0.07];
const BASE_OPACITY = 0.4;

/** One sheet from the handset to the side of the candle, and two loose strands beside it. */
const SPECS: readonly WebSpec[] = [
  {
    hub: HUB,
    rim: [
      [0.182, 0.108, -0.152],
      [0.184, 0.088, -0.158],
      [0.184, 0.066, -0.16],
      [0.182, 0.044, -0.158],
    ],
    rings: 4,
    sag: 0.012,
    seed: 11,
  },
  { hub: HUB, rim: [[0.155, 0.1, -0.1]], rings: 3, sag: 0.014, seed: 23 },
  { hub: HUB, rim: [[0.145, 0.02, -0.1]], rings: 3, sag: 0.01, seed: 37 },
];

/** Joins every spec into one buffer, and gives each end of each strand a colour from how near it is to the flame. */
function buildWeb(): { positions: Float32Array; colours: Float32Array } {
  const parts = SPECS.map(webSegments);
  const world = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    world.set(part, at);
    at += part.length;
  }
  const colours = new Float32Array(world.length);
  const positions = new Float32Array(world.length);
  for (let i = 0; i < world.length; i += 3) {
    const point: Vec3 = [world[i] as number, world[i + 1] as number, world[i + 2] as number];
    const sheen = strandSheen(point, FLAME);
    colours.set([1 * sheen, 0.8 * sheen, 0.55 * sheen], i);
    // The group sits on the hub, so it can tilt about the place the web is fixed.
    positions.set([point[0] - HUB[0], point[1] - HUB[1], point[2] - HUB[2]], i);
  }
  return { positions, colours };
}

/** Fine cobwebs that catch the candle light, with a slow tiny sway. */
export function Cobwebs() {
  const reducedMotion = usePrefersReducedMotion();
  const group = useRef<THREE.Group>(null);
  const material = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const { positions, colours } = buildWeb();
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('color', new THREE.BufferAttribute(colours, 3));
    return g;
  }, []);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  useFrame(({ clock }) => {
    const { swayX, swayZ, shimmer } = webMotion(clock.elapsedTime, reducedMotion);
    if (group.current) group.current.rotation.set(swayX, 0, swayZ);
    if (material.current) material.current.opacity = BASE_OPACITY * shimmer;
  });

  return (
    <group ref={group} position={HUB}>
      <lineSegments geometry={geometry} frustumCulled={false}>
        <lineBasicMaterial
          ref={material}
          vertexColors
          transparent
          opacity={BASE_OPACITY}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}
