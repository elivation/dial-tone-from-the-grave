import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { FLIP_STRIP, flipFromStrip } from './flipStrip';

describe('flipFromStrip', () => {
  it('[Req 13.2] the outer edge of the left page goes back and of the right page goes forward', () => {
    expect(flipFromStrip('left', 0)).toBe(-1);
    expect(flipFromStrip('right', 1)).toBe(1);
  });

  it('[Req 13.2] the spine edge of either page turns nothing', () => {
    expect(flipFromStrip('left', 1)).toBeNull();
    expect(flipFromStrip('right', 0)).toBeNull();
  });

  it('[Req 13.2] the strip is a narrow band, not most of the page', () => {
    expect(FLIP_STRIP).toBeGreaterThan(0.05);
    expect(FLIP_STRIP).toBeLessThanOrEqual(0.2);
  });

  it('[Req 13.2] a point is in the strip exactly when it is within the strip width of the outer edge', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (u) => {
        expect(flipFromStrip('left', u) === -1).toBe(u < FLIP_STRIP);
        expect(flipFromStrip('right', u) === 1).toBe(u > 1 - FLIP_STRIP);
        expect([null, -1]).toContain(flipFromStrip('left', u));
        expect([null, 1]).toContain(flipFromStrip('right', u));
      }),
    );
  });
});
