'use client';
import { useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { fogDensityFor, frameCamera, type CameraFraming } from './cameraFraming';

/** How quickly the camera settles on a new framing, per second. About 0.6 s to arrive. */
const SETTLE_RATE = 6;
const ARRIVED = 0.0005;

/** Looks at the phone, and moves back to take in the book when it is open. */
export function CameraRig({ bookOpen }: { bookOpen: boolean }) {
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const getState = useThree((s) => s.get);
  const reducedMotion = usePrefersReducedMotion();
  const fov = camera instanceof THREE.PerspectiveCamera ? camera.fov : 0;
  const goal = useMemo(
    () => (fov > 0 ? frameCamera(size.width / Math.max(1, size.height), fov, bookOpen) : null),
    [fov, size, bookOpen],
  );
  // Where the camera is looking right now, which lags the goal while it glides.
  const shown = useRef<CameraFraming | null>(null);
  const place = (framing: CameraFraming) => {
    camera.position.copy(framing.position);
    camera.lookAt(framing.target);
    const { fog } = getState().scene;
    if (fog instanceof THREE.FogExp2) {
      fog.density = fogDensityFor(framing.position.distanceTo(framing.target));
    }
  };
  useLayoutEffect(() => {
    if (!goal) return;
    // First frame, and reduced motion: no glide.
    if (shown.current === null || reducedMotion) {
      shown.current = { position: goal.position.clone(), target: goal.target.clone() };
      place(goal);
      camera.updateProjectionMatrix();
    }
    // `place` only reads the camera, which is the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goal, reducedMotion, camera]);
  useFrame((_, delta) => {
    const current = shown.current;
    if (!goal || !current) return;
    const apart =
      current.position.distanceTo(goal.position) + current.target.distanceTo(goal.target);
    if (apart < ARRIVED) return;
    const k = 1 - Math.exp(-SETTLE_RATE * delta);
    current.position.lerp(goal.position, k);
    current.target.lerp(goal.target, k);
    place(current);
  });
  return null;
}
