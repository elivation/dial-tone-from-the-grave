'use client';

import { useMemo } from 'react';
import { seededRandom } from './noise';
import { CANDLE_X } from './sceneConstants';

const COUNT = 400;

/** Specks of dust hanging in the candle light. */
export function DustMotes() {
  const positions = useMemo(() => {
    const random = seededRandom(9);
    const values = new Float32Array(COUNT * 3);
    for (let i = 0; i < COUNT; i++) {
      values[i * 3] = CANDLE_X - 0.35 + random() * 0.55;
      values[i * 3 + 1] = 0.02 + random() * 0.3;
      values[i * 3 + 2] = -0.2 + random() * 0.45;
    }
    return values;
  }, []);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={0xffd3a0}
        size={0.0012}
        transparent
        opacity={0.35}
        depthWrite={false}
      />
    </points>
  );
}
