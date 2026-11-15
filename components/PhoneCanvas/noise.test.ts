import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { fbm, seededRandom } from './noise';

describe('seededRandom', () => {
  it('gives the same sequence for the same seed', () => {
    const a = seededRandom(7);
    const b = seededRandom(7);
    expect(Array.from({ length: 20 }, a)).toEqual(Array.from({ length: 20 }, b));
  });

  it('gives different sequences for different seeds', () => {
    expect(seededRandom(1)()).not.toBe(seededRandom(2)());
  });

  it('stays inside [0, 1)', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 1_000_000 }), (seed) => {
        const next = seededRandom(seed);
        for (let i = 0; i < 50; i++) {
          const v = next();
          if (v < 0 || v >= 1) return false;
        }
        return true;
      }),
    );
  });
});

describe('fbm', () => {
  it('is deterministic and stays inside [0, 1)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: -50, max: 50, noNaN: true }),
        fc.float({ min: -50, max: 50, noNaN: true }),
        (x, y) => {
          const v = fbm(x, y);
          return v === fbm(x, y) && v >= 0 && v < 1;
        },
      ),
    );
  });
});
