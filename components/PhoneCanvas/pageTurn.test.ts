import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { TURN_SECONDS, leafProfile, turnEase } from './pageTurn';

const LENGTH = 0.21;
const COLUMNS = 24;
const direction = fc.constantFrom<1 | -1>(1, -1);
const progress = fc.double({ min: 0, max: 1, noNaN: true });

describe('turnEase', () => {
  it('[Req 13.2] runs from 0 to 1, slowly at each end', () => {
    expect(turnEase(0)).toBe(0);
    expect(turnEase(1)).toBe(1);
    expect(turnEase(0.5)).toBeCloseTo(0.5, 6);
    expect(turnEase(0.1)).toBeLessThan(0.1);
    expect(turnEase(0.9)).toBeGreaterThan(0.9);
  });

  it('[Req 13.2] only goes forward and stays within 0 and 1 for any progress', () => {
    fc.assert(
      fc.property(progress, progress, (a, b) => {
        const [lo, hi] = a <= b ? [a, b] : [b, a];
        expect(turnEase(lo)).toBeLessThanOrEqual(turnEase(hi) + 1e-12);
        expect(turnEase(a)).toBeGreaterThanOrEqual(0);
        expect(turnEase(a)).toBeLessThanOrEqual(1);
      }),
    );
  });

  it('[Req 13.2] takes between half and one second', () => {
    expect(TURN_SECONDS).toBeGreaterThanOrEqual(0.5);
    expect(TURN_SECONDS).toBeLessThanOrEqual(0.8);
  });
});

describe('leafProfile', () => {
  const at = (dir: 1 | -1, p: number) => leafProfile(dir, p, COLUMNS, LENGTH);

  it('[Req 13.2] a forward turn starts lying on the right page and ends lying on the left', () => {
    const start = at(1, 0);
    const end = at(1, 1);
    for (let i = 0; i <= COLUMNS; i++) {
      const along = (i / COLUMNS) * LENGTH;
      expect(start.x[i]).toBeCloseTo(along, 9);
      expect(start.y[i]).toBeCloseTo(0, 9);
      expect(end.x[i]).toBeCloseTo(-along, 9);
      expect(end.y[i]).toBeCloseTo(0, 9);
    }
  });

  it('[Req 13.2] a backward turn is a forward turn run the other way', () => {
    const a = at(-1, 0);
    const b = at(1, 1);
    for (let i = 0; i <= COLUMNS; i++) {
      expect(a.x[i]).toBeCloseTo(b.x[i]!, 9);
    }
  });

  it('[Req 13.2] stands upright, over the spine, half way through', () => {
    const mid = at(1, 0.5);
    expect(Math.max(...mid.y)).toBeGreaterThan(LENGTH * 0.7);
  });

  it('[Req 13.2] the leaf is hinged at the spine and never stretches or shrinks', () => {
    fc.assert(
      fc.property(direction, progress, (dir, p) => {
        const { x, y } = at(dir, p);
        expect(x[0]).toBe(0);
        expect(y[0]).toBe(0);
        for (let i = 1; i <= COLUMNS; i++) {
          const step = Math.hypot(x[i]! - x[i - 1]!, y[i]! - y[i - 1]!);
          expect(step).toBeCloseTo(LENGTH / COLUMNS, 9);
        }
      }),
    );
  });

  it('[Req 13.2] progress outside 0 to 1 is held at the nearest end', () => {
    expect(at(1, -3).x).toEqual(at(1, 0).x);
    expect(at(1, 7).x).toEqual(at(1, 1).x);
  });
});
