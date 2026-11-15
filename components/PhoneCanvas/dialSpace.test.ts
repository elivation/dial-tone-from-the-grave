import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import { DIGITS, HOLE_ANGLES } from '@/lib/dial';
import { angleInDial, downhillOf, holeAtPoint, pointOnDialPlane, radiusInDial } from './dialSpace';
import { angleGap, makeDial, pointAt } from './__fixtures__/dial';

const dial = makeDial(true);

describe('[Req 1.1] angleInDial and radiusInDial', () => {
  it('read back where a point was placed, however high it floats above the face', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 359.99, noNaN: true }),
        fc.double({ min: 0.001, max: 0.03, noNaN: true }),
        fc.double({ min: -0.01, max: 0.01, noNaN: true }),
        (degrees, r, lift) => {
          const p = pointAt(dial, degrees, r, lift);
          return (
            angleGap(angleInDial(p, dial), degrees) < 1e-6 &&
            Math.abs(radiusInDial(p, dial) - r) < 1e-9
          );
        },
      ),
    );
  });

  it('always answers in [0, 360)', () => {
    fc.assert(
      fc.property(fc.double({ min: -720, max: 720, noNaN: true }), (degrees) => {
        const a = angleInDial(pointAt(dial, degrees, 0.02), dial);
        return a >= 0 && a < 360;
      }),
    );
  });
});

describe('[Req 1.1, 1.5] holeAtPoint', () => {
  it('finds the right digit for a finger anywhere inside a hole', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...DIGITS),
        fc.double({ min: -10, max: 10, noNaN: true }),
        fc.double({ min: 0.8, max: 1.2, noNaN: true }),
        (digit, wobble, scale) =>
          holeAtPoint(pointAt(dial, HOLE_ANGLES[digit] + wobble, dial.holeR * scale), dial) ===
          digit,
      ),
    );
  });

  it('finds nothing in the middle of the dial, on the card', () => {
    expect(holeAtPoint(pointAt(dial, 45, 0.003), dial)).toBeNull();
  });

  it('finds nothing off the edge of the wheel', () => {
    expect(holeAtPoint(pointAt(dial, HOLE_ANGLES['5'], dial.radius * 1.5), dial)).toBeNull();
  });

  it('finds nothing in the gap between the 0 hole and the finger stop', () => {
    // The wheel has an empty stretch here, and the 1 and 0 holes are far apart.
    expect(holeAtPoint(pointAt(dial, 115, dial.holeR), dial)).toBeNull();
  });
});

describe('pointOnDialPlane', () => {
  it('finds where a ray from the camera meets the dial', () => {
    const target = pointAt(dial, 200, 0.02);
    const from = target
      .clone()
      .addScaledVector(dial.normal, 0.4)
      .add(new THREE.Vector3(0.05, 0, 0.03));
    const ray = new THREE.Ray(from, target.clone().sub(from).normalize());
    const hit = pointOnDialPlane(ray, dial);
    expect(hit).not.toBeNull();
    expect(hit?.distanceTo(target)).toBeLessThan(1e-9);
  });

  it('finds nothing for a ray running parallel to the dial', () => {
    const from = pointAt(dial, 0, 0.02, 0.1);
    expect(pointOnDialPlane(new THREE.Ray(from, dial.uAx.clone()), dial)).toBeNull();
  });

  it('finds nothing for a ray pointing away from the dial', () => {
    const from = pointAt(dial, 0, 0.02, 0.1);
    expect(pointOnDialPlane(new THREE.Ray(from, dial.normal.clone()), dial)).toBeNull();
  });
});

describe('downhillOf', () => {
  it('lies in the dial plane and points down, whichever way the dial leans', () => {
    const { normal } = makeDial(true);
    const downhill = downhillOf(normal);
    expect(downhill.length()).toBeCloseTo(1, 9);
    expect(downhill.dot(normal)).toBeCloseTo(0, 9);
    expect(downhill.dot(new THREE.Vector3(0, 1, 0))).toBeLessThan(0);
  });
});
