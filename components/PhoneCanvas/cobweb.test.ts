import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { COBWEB, strandSheen, webMotion, webSegments, type WebSpec } from './cobweb';

const SPEC: WebSpec = {
  hub: [0.1, 0.09, -0.06],
  rim: [
    [0.17, 0.12, -0.1],
    [0.18, 0.08, -0.13],
    [0.17, 0.04, -0.15],
    [0.15, 0.02, -0.16],
  ],
  rings: 4,
  sag: 0.004,
  seed: 5,
};

describe('webSegments', () => {
  it('[Req 1.1] draws every radial strand in full, and never more than every cross strand', () => {
    const { rim, rings } = SPEC;
    const radials = rim.length * rings;
    const crosses = (rim.length - 1) * rings;
    const count = webSegments(SPEC).length / 6;
    expect(count).toBeGreaterThanOrEqual(radials);
    expect(count).toBeLessThanOrEqual(radials + crosses);
  });

  it('[Req 1.1] leaves some cross strands out so the web looks old and torn', () => {
    const { rim, rings } = SPEC;
    const full = rim.length * rings + (rim.length - 1) * rings;
    const counts = new Set(
      Array.from({ length: 12 }, (_, seed) => webSegments({ ...SPEC, seed: seed + 1 }).length / 6),
    );
    expect(Math.min(...counts)).toBeLessThan(full);
    expect(counts.size).toBeGreaterThan(1);
  });

  it('[Req 1.1] is the same every time for the same seed', () => {
    expect(webSegments(SPEC)).toEqual(webSegments(SPEC));
  });

  it('[Req 1.1] [P17] stays finite and inside the hub and rim box, give or take the sag', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 1, max: 6 }),
        (seed, rings) => {
          const points = webSegments({ ...SPEC, seed, rings });
          const all = [SPEC.hub, ...SPEC.rim];
          const slack = SPEC.sag + 0.002;
          for (let i = 0; i < points.length; i += 3) {
            for (let axis = 0; axis < 3; axis++) {
              const value = points[i + axis] as number;
              const lows = all.map((p) => p[axis] as number);
              expect(Number.isFinite(value)).toBe(true);
              expect(value).toBeGreaterThanOrEqual(Math.min(...lows) - slack);
              expect(value).toBeLessThanOrEqual(Math.max(...lows) + slack);
            }
          }
        },
      ),
    );
  });
});

describe('strandSheen', () => {
  it('[Req 1.1] [P18] is between 0 and 1 and gets dimmer the further from the flame', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.001, max: 2, noNaN: true }),
        fc.double({ min: 0.001, max: 2, noNaN: true }),
        (a, b) => {
          const near = Math.min(a, b);
          const far = Math.max(a, b);
          const nearSheen = strandSheen([near, 0, 0], [0, 0, 0]);
          const farSheen = strandSheen([far, 0, 0], [0, 0, 0]);
          expect(nearSheen).toBeGreaterThanOrEqual(0);
          expect(nearSheen).toBeLessThanOrEqual(1);
          expect(farSheen).toBeLessThanOrEqual(nearSheen);
        },
      ),
    );
  });

  it('[Req 1.1] keeps a faint glint on strands far from the flame so the web never vanishes', () => {
    expect(strandSheen([5, 0, 0], [0, 0, 0])).toBeGreaterThan(0);
  });
});

describe('webMotion', () => {
  it('[Req 9.4] holds still, at full brightness, with reduced motion', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), (t) => {
        expect(webMotion(t, true)).toEqual({ swayX: 0, swayZ: 0, shimmer: 1 });
      }),
    );
  });

  it('[Req 9.4] sways only a tiny amount and shimmers only a little otherwise', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), (t) => {
        const { swayX, swayZ, shimmer } = webMotion(t, false);
        expect(Math.abs(swayX)).toBeLessThanOrEqual(COBWEB.maxSway);
        expect(Math.abs(swayZ)).toBeLessThanOrEqual(COBWEB.maxSway);
        expect(Math.abs(shimmer - 1)).toBeLessThanOrEqual(COBWEB.maxShimmer);
      }),
    );
  });
});
