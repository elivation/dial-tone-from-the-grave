// @vitest-environment node
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { downhillOf } from './dialSpace';
import { dripFootprint, findDripStart, overlapsHoleWhileTurning } from './dripSites';
import { makeDial, pointAt } from './__fixtures__/dial';

/** Holes fill a ring from 15 mm to 24 mm out, at every angle once the wheel has turned. The wheel's edge is 29 mm. */
const dial = () => ({
  ...makeDial(true),
  isOpen: (r: number) => r >= 0.015 && r <= 0.024,
});

describe('downhillOf', () => {
  it('lies in the dial plane and points down, whichever way the dial leans', () => {
    for (const tilted of [true, false]) {
      const { normal } = makeDial(tilted);
      const downhill = downhillOf(normal);
      if (!tilted) {
        // A dial lying flat has no downhill.
        expect(downhill.length()).toBe(0);
        continue;
      }
      expect(downhill.length()).toBeCloseTo(1, 9);
      expect(downhill.dot(normal)).toBeCloseTo(0, 9);
      expect(downhill.dot(new THREE.Vector3(0, 1, 0))).toBeLessThan(0);
    }
  });
});

describe('overlapsHoleWhileTurning', () => {
  it('[Req 1.1] is true for a spot in the ring the holes sweep, even if no hole is there at rest', () => {
    expect(overlapsHoleWhileTurning([pointAt(dial(), 100, 0.02)], dial())).toBe(true);
  });

  it('is false outside the ring of holes, and ignores the rim of the wheel', () => {
    expect(overlapsHoleWhileTurning([pointAt(dial(), 100, 0.026)], dial())).toBe(false);
    const open = { ...dial(), isOpen: () => true };
    expect(overlapsHoleWhileTurning([pointAt(open, 100, 0.0285)], open)).toBe(false);
  });
});

describe('findDripStart', () => {
  const holeRadius = 0.004;
  const outward = (d: ReturnType<typeof dial>) =>
    pointAt(d, 0, 1)
      .sub(pointAt(d, 0, 0))
      .normalize();

  it('starts at the hole rim when that is already clear of the holes', () => {
    const d = { ...dial(), isOpen: (r: number) => r >= 0.015 && r <= 0.02 };
    const middle = pointAt(d, 0, 0.0175);
    const start = findDripStart({
      dial: d,
      holeMiddle: middle,
      direction: outward(d),
      length: 0.003,
      holeRadius,
    });
    expect(start).not.toBeNull();
    expect(start?.distanceTo(middle)).toBeLessThan(holeRadius * 1.3);
  });

  it('moves out past the ring the holes sweep when the rim is not clear', () => {
    const d = dial();
    const middle = pointAt(d, 0, 0.02);
    const start = findDripStart({
      dial: d,
      holeMiddle: middle,
      direction: outward(d),
      length: 0.003,
      holeRadius,
    });
    expect(start).not.toBeNull();
    // Beyond the outer edge of the ring, with room for the width of the drip.
    expect(start?.distanceTo(d.centre)).toBeGreaterThan(0.024);
  });

  it('gives up if no clear place is within reach', () => {
    const d = { ...dial(), isOpen: (r: number) => r >= 0.015 && r <= 0.028 };
    const middle = pointAt(d, 0, 0.02);
    expect(
      findDripStart({
        dial: d,
        holeMiddle: middle,
        direction: outward(d),
        length: 0.003,
        holeRadius,
      }),
    ).toBeNull();
  });

  it('keeps the footprint across the whole length and width of the drip', () => {
    const d = dial();
    const points = dripFootprint(pointAt(d, 0, 0.026), outward(d), 0.003, holeRadius, d.normal);
    const reaches = points.map((p) => p.distanceTo(pointAt(d, 0, 0.026)));
    expect(Math.max(...reaches)).toBeGreaterThan(0.003);
    expect(points.length).toBeGreaterThan(50);
  });
});
