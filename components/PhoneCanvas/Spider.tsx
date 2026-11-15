'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import type * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { buildSpider } from './buildSpider';

/** A hairy spider by the cord. It breathes, and now and then a leg twitches. */
export function Spider() {
  const reducedMotion = usePrefersReducedMotion();
  const spider = useMemo(() => buildSpider(), []);
  const body = useRef<THREE.Group>(null);
  const twitchingLeg = useRef<THREE.Mesh | null>(null);

  useLayoutEffect(() => {
    twitchingLeg.current = spider.legs[2] ?? null;
  }, [spider]);

  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const t = clock.elapsedTime;
    if (body.current) body.current.scale.y = 1 + Math.sin(t * 1.7) * 0.02;
    if (twitchingLeg.current) {
      twitchingLeg.current.rotation.y = Math.pow(Math.max(0, Math.sin(t * 0.7)), 8) * 0.05;
    }
  });

  return (
    <group position={[-0.085, 0, 0.045]} rotation-y={-0.5} scale={1.25}>
      <group ref={body}>
        <primitive object={spider.group} />
      </group>
    </group>
  );
}
