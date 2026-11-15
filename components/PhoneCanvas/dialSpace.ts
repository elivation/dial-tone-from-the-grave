import * as THREE from 'three';
import { DIGITS, HOLE_ANGLES, type Digit } from '@/lib/dial';
import type { DialGeometry } from './dialGeometry';

/** Half the gap between two holes. A finger this close to a hole is in it. */
const PICK_DEGREES = 15;
/** Fingers closer to the middle than this are on the card, not in a hole. */
const INNER_FRACTION = 0.55;

const relative = (point: THREE.Vector3, dial: DialGeometry) => point.clone().sub(dial.centre);

/** How far a point is from the dial's axis, in metres, however high it floats above the face. */
export function radiusInDial(point: THREE.Vector3, dial: DialGeometry): number {
  const d = relative(point, dial);
  return Math.hypot(d.dot(dial.uAx), d.dot(dial.rAx));
}

/** Degrees clockwise from 12 o'clock, as seen looking at the dial, in [0, 360). */
export function angleInDial(point: THREE.Vector3, dial: DialGeometry): number {
  const d = relative(point, dial);
  const degrees = THREE.MathUtils.radToDeg(Math.atan2(d.dot(dial.rAx), d.dot(dial.uAx)));
  return ((degrees % 360) + 360) % 360;
}

/**
 * The way a drop of slime runs across the dial face: world down, projected onto the dial plane.
 * `normal` is the dial normal. It is never hard-coded, because the phone is tilted and turned.
 */
export function downhillOf(normal: THREE.Vector3): THREE.Vector3 {
  const down = new THREE.Vector3(0, -1, 0);
  return down.addScaledVector(normal, -down.dot(normal)).normalize();
}

/** Where a ray from the camera meets the plane of the dial, or null if it never does. */
export function pointOnDialPlane(ray: THREE.Ray, dial: DialGeometry): THREE.Vector3 | null {
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(dial.normal, dial.centre);
  return ray.intersectPlane(plane, new THREE.Vector3());
}

const gap = (a: number, b: number) => Math.abs(((((a - b) % 360) + 540) % 360) - 180);

/** The digit whose hole a finger at this point is in, or null if it is on the card, the rim or the empty stretch. */
export function holeAtPoint(point: THREE.Vector3, dial: DialGeometry): Digit | null {
  const r = radiusInDial(point, dial);
  if (r < dial.holeR * INNER_FRACTION || r > dial.radius) return null;
  const angle = angleInDial(point, dial);
  let found: Digit | null = null;
  let nearest = PICK_DEGREES;
  for (const digit of DIGITS) {
    const distance = gap(angle, HOLE_ANGLES[digit]);
    if (distance < nearest) {
      found = digit;
      nearest = distance;
    }
  }
  return found;
}
