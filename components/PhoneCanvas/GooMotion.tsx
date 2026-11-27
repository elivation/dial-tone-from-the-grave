'use client';
import { useFrame } from '@react-three/fiber';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';
import { updateGooWobble } from './gooWobble';

/** Drives the jelly's slow wobble. Renders nothing. */
export function GooMotion() {
  const reducedMotion = usePrefersReducedMotion();
  useFrame(({ clock }) => updateGooWobble(clock.elapsedTime, reducedMotion));
  return null;
}
