import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

// Tests written before implementation (TDD).
// Import will fail until lib/dial.ts exports these.
import { HOLE_ANGLES, PULSES, returnDuration, shouldRegister } from './dial';

const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const;
type Digit = (typeof DIGITS)[number];

describe('lib/dial', () => {
  // ── P1: return duration = pulse count * 100 ms ────────────────────────────
  it('[P1][Req 1.3] returnDuration(d) === PULSES[d] * 100 for all digits', () => {
    fc.assert(
      fc.property(fc.constantFrom(...DIGITS), (d: Digit) => {
        const pulses = PULSES[d];
        expect(pulses).toBeDefined();
        return returnDuration(d) === (pulses ?? 0) * 100;
      }),
    );
  });

  // ── P2: pulse count matches face value (1-9) or 10 for '0' ───────────────
  it('[P2][Req 1.4] PULSES[d] equals face value for 1-9, equals 10 for "0"', () => {
    fc.assert(
      fc.property(fc.constantFrom(...DIGITS), (d: Digit) => {
        const pulses = PULSES[d];
        expect(pulses).toBeDefined();
        if (d === '0') {
          return pulses === 10;
        }
        return pulses === parseInt(d, 10);
      }),
    );
  });

  // ── P3: all HOLE_ANGLES are unique integers in [0, 360) ──────────────────
  it('[P3][Req 1.1] HOLE_ANGLES are unique integers in [0, 360)', () => {
    const angles = Object.values(HOLE_ANGLES);
    // All integers
    expect(angles.every((a) => Number.isInteger(a))).toBe(true);
    // All in range
    expect(angles.every((a) => a >= 0 && a < 360)).toBe(true);
    // All unique
    expect(new Set(angles).size).toBe(angles.length);
    // One per digit
    expect(angles.length).toBe(10);
  });

  // ── P4: shouldRegister within 3 degrees of stop, false outside ───────────
  it('[P4][Req 1.1, 1.2] shouldRegister is true within 3 degrees of stop, false outside', () => {
    // Within tolerance: angle at stop or within 3 degrees before it
    fc.assert(
      fc.property(
        fc.constantFrom(...DIGITS),
        fc.float({ min: Math.fround(0), max: Math.fround(3), noNaN: true }),
        (d: Digit, offset: number) => {
          // Simulate a drag that reached within tolerance of the stop
          return shouldRegister(d, offset) === true;
        },
      ),
    );

    // Outside tolerance: more than 3 degrees before stop
    fc.assert(
      fc.property(
        fc.constantFrom(...DIGITS),
        fc.float({ min: Math.fround(3.01), max: Math.fround(180), noNaN: true }),
        (d: Digit, offset: number) => {
          return shouldRegister(d, offset) === false;
        },
      ),
    );
  });
});
