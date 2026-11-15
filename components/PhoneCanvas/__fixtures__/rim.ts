import * as THREE from 'three';
import type { PreparedPhone } from '../preparePhone';

const SAMPLES = 24;
/** Just outside the open part of the hole, on the wheel's top surface. */
const REACH = 1.15;

/**
 * The lowest point of the wheel's top surface round a hole, along the dial normal from the dial
 * centre, found by casting rays straight down at the wheel. Independent of how the goo works it out.
 * `middle` is anywhere on the hole's axis.
 */
export function rimHeightAt(
  phone: PreparedPhone,
  middle: THREE.Vector3,
  holeRadius: number,
): number {
  const { dial, wheel } = phone;
  wheel.updateWorldMatrix(true, false);
  const raycaster = new THREE.Raycaster();
  const down = dial.normal.clone().negate();
  let lowest = Infinity;
  for (let k = 0; k < SAMPLES; k++) {
    const t = (k / SAMPLES) * Math.PI * 2;
    const at = middle
      .clone()
      .addScaledVector(dial.uAx, Math.cos(t) * holeRadius * REACH)
      .addScaledVector(dial.rAx, Math.sin(t) * holeRadius * REACH);
    raycaster.set(at.addScaledVector(dial.normal, 0.02), down);
    const hit = raycaster.intersectObject(wheel, false)[0];
    if (hit) lowest = Math.min(lowest, hit.point.clone().sub(dial.centre).dot(dial.normal));
  }
  return lowest;
}
