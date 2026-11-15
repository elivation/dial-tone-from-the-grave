'use client';

import { useMemo } from 'react';
import * as THREE from 'three';
import { useTexture } from '@react-three/drei';
import { contactShadowTexture, deskRoughnessTexture } from './sceneTextures';

const DESK_TINT = new THREE.Color(0.75, 0.68, 0.6);

/** Dark wooden planks, stained, with a soft shadow where the phone sits. */
export function Desk() {
  const map = useTexture('/textures/dark_wooden_planks_diff_2k.webp', (texture) => {
    const planks = Array.isArray(texture) ? texture : [texture];
    for (const t of planks) {
      t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(4, 4);
      t.anisotropy = 16;
    }
  });
  const roughnessMap = useMemo(() => deskRoughnessTexture(), []);
  const shadowMap = useMemo(() => contactShadowTexture(), []);

  return (
    <>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[3, 3]} />
        <meshStandardMaterial
          map={map}
          roughnessMap={roughnessMap}
          roughness={0.85}
          color={DESK_TINT}
        />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0.3]} position-y={0.0006}>
        <planeGeometry args={[0.3, 0.26]} />
        <meshBasicMaterial map={shadowMap} transparent depthWrite={false} />
      </mesh>
    </>
  );
}
