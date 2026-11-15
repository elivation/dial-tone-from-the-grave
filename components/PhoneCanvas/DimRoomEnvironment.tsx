'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/**
 * A very faint room reflection, so glossy parts catch a little light beyond the candle.
 * The strength is set on the Canvas scene (environmentIntensity).
 */
export function DimRoomEnvironment() {
  const gl = useThree((s) => s.gl);
  const texture = useMemo(() => {
    const generator = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    generator.dispose();
    room.dispose();
    return target.texture;
  }, [gl]);

  useEffect(() => () => texture.dispose(), [texture]);

  return <primitive object={texture} attach="environment" />;
}
