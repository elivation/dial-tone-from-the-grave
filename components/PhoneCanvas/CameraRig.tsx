'use client';

import { useLayoutEffect } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';

const TARGET = new THREE.Vector3(0.05, 0.055, 0);
const HOME = new THREE.Vector3(-0.06, 0.2, 0.5);
/** The view must show at least this much of the desk, so the phone is never cut off on a tall screen. */
const MIN_VISIBLE_WIDTH = 0.3;

/** Looks at the phone, and backs away on narrow screens. */
export function CameraRig() {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);

  useLayoutEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    const aspect = size.width / Math.max(1, size.height);
    const halfHeight = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const homeDistance = HOME.distanceTo(TARGET);
    const needed = MIN_VISIBLE_WIDTH / (2 * halfHeight * aspect);
    const factor = Math.max(1, needed / homeDistance);
    camera.position.copy(TARGET).addScaledVector(HOME.clone().sub(TARGET), factor);
    camera.lookAt(TARGET);
    camera.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}
