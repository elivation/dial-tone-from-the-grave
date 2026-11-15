import * as THREE from 'three';
import { travelDegrees } from '@/lib/dial';
import type { DialGeometry } from './dialGeometry';
import { angleInDial, radiusInDial } from './dialSpace';
import { dripProfile } from './gooShapes';

/** Past this fraction of the wheel's radius there are no holes, only the rim of the wheel. */
const RIM_FRACTION = 0.97;
const TURN_STEP_DEGREES = 2;
/** How far from the hole's middle a drip may start, in hole radii. The first value is at the rim. */
const START_REACH = { min: 1, max: 1.6, step: 0.1 };
const FOOTPRINT_STEPS = 16;
const ACROSS = [-1, -0.5, 0, 0.5, 1];
/** Extra width the footprint allows, in hole radii, for the wobble in the drip's outline. */
const FOOTPRINT_MARGIN = 0.15;

/**
 * True if any of the points would sit over a finger hole at some turn of the wheel, from rest to
 * a full 0. A drip lies still on the plate while the holes sweep past above it, so it must stay
 * out of their path.
 */
export function overlapsHoleWhileTurning(points: THREE.Vector3[], dial: DialGeometry): boolean {
  const mostTurn = travelDegrees('0');
  for (const point of points) {
    const r = radiusInDial(point, dial);
    if (r >= dial.radius * RIM_FRACTION) continue;
    const at = angleInDial(point, dial);
    // The wheel turns clockwise, so what is over this spot now was `turn` degrees anticlockwise at rest.
    for (let turn = 0; turn <= mostTurn; turn += TURN_STEP_DEGREES) {
      if (dial.isOpen(r, at - turn)) return true;
    }
  }
  return false;
}

/** Points that cover a drip lying from `start` along `direction`, widest allowance included. */
export function dripFootprint(
  start: THREE.Vector3,
  direction: THREE.Vector3,
  length: number,
  holeRadius: number,
  normal: THREE.Vector3,
): THREE.Vector3[] {
  const side = new THREE.Vector3().crossVectors(normal, direction).normalize();
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= FOOTPRINT_STEPS; i++) {
    const s = i / FOOTPRINT_STEPS;
    const centre = start.clone().addScaledVector(direction, s * length);
    const half = (dripProfile(s).width + FOOTPRINT_MARGIN) * holeRadius;
    for (const across of ACROSS) points.push(centre.clone().addScaledVector(side, across * half));
  }
  return points;
}

export type DripSiteInput = {
  dial: DialGeometry;
  /** Middle of the hole, on the plane of the dial. */
  holeMiddle: THREE.Vector3;
  /** Unit vector in the plane of the dial, the way the drip runs. */
  direction: THREE.Vector3;
  length: number;
  holeRadius: number;
};

/**
 * Where a drip can start: as close to the rim of its hole as it can be while staying out of the
 * way of every hole as the wheel turns. Null if there is no such place within a short reach.
 */
export function findDripStart({
  dial,
  holeMiddle,
  direction,
  length,
  holeRadius,
}: DripSiteInput): THREE.Vector3 | null {
  for (let t = START_REACH.min; t <= START_REACH.max + 1e-9; t += START_REACH.step) {
    const start = holeMiddle.clone().addScaledVector(direction, t * holeRadius);
    const footprint = dripFootprint(start, direction, length, holeRadius, dial.normal);
    if (!overlapsHoleWhileTurning(footprint, dial)) return start;
  }
  return null;
}
