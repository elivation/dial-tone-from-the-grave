import * as THREE from 'three';
import { DIGITS, HOLE_ANGLES } from '@/lib/dial';
import type { DialGeometry } from '../dialGeometry';

/**
 * A made-up dial for tests. `tilted` leans it the way the real phone's dial leans,
 * so tests do not pass by luck on a dial that faces straight up.
 */
export function makeDial(tilted: boolean): DialGeometry {
  const normal = tilted
    ? new THREE.Vector3(-0.127, 0.916, 0.381).normalize()
    : new THREE.Vector3(0, 1, 0);
  const back = new THREE.Vector3(0, 0, -1);
  const uAx = back.sub(normal.clone().multiplyScalar(back.dot(normal))).normalize();
  const rAx = new THREE.Vector3().crossVectors(uAx, normal).normalize();
  return {
    centre: new THREE.Vector3(0.01, 0.06, -0.02),
    normal,
    uAx,
    rAx,
    radius: 0.029,
    holeR: 0.02,
    holeAngles: DIGITS.map((d) => HOLE_ANGLES[d]),
    holeWidth: 20,
    isOpen: () => true,
  };
}

/** A point on the dial at `degrees` clockwise from 12 o'clock, `r` metres out and `lift` metres off the face. */
export function pointAt(dial: DialGeometry, degrees: number, r: number, lift = 0): THREE.Vector3 {
  const t = THREE.MathUtils.degToRad(degrees);
  return dial.centre
    .clone()
    .addScaledVector(dial.uAx, Math.cos(t) * r)
    .addScaledVector(dial.rAx, Math.sin(t) * r)
    .addScaledVector(dial.normal, lift);
}

/** Shortest distance between two angles, in degrees. */
export function angleGap(a: number, b: number): number {
  const d = ((((a - b) % 360) + 540) % 360) - 180;
  return Math.abs(d);
}
