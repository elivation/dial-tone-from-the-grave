import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  DIGITS,
  HOLE_ANGLES,
  HOLE_SPACING,
  PULSES,
  STOP_ANGLE,
  accumulateRotation,
  digitFromHoleIndex,
  pointerAngle,
  returnDuration,
  shouldRegister,
  travelDegrees,
  type Digit,
} from './dial';

const digitArb = fc.constantFrom(...DIGITS);
const angleArb = fc.double({ min: 0, max: 359.999, noNaN: true });

describe('lib/dial', () => {
  // P1: return duration = pulse count * 100 ms
  it('[P1][Req 1.3] returnDuration(d) === PULSES[d] * 100 for all digits', () => {
    fc.assert(fc.property(digitArb, (d: Digit) => returnDuration(d) === PULSES[d] * 100));
  });

  // P2: pulse count matches face value (1-9) or 10 for '0'
  it('[P2][Req 1.4] PULSES[d] equals face value for 1-9, equals 10 for "0"', () => {
    fc.assert(
      fc.property(digitArb, (d: Digit) =>
        d === '0' ? PULSES[d] === 10 : PULSES[d] === Number.parseInt(d, 10),
      ),
    );
  });

  // P3: hole angles are unique integers in [0, 360)
  it('[P3][Req 1.1] HOLE_ANGLES are unique integers in [0, 360)', () => {
    const angles = DIGITS.map((d) => HOLE_ANGLES[d]);
    expect(angles.every((a) => Number.isInteger(a) && a >= 0 && a < 360)).toBe(true);
    expect(new Set(angles).size).toBe(10);
  });

  // P3b: geometry matches a real dial. Every hole sits anticlockwise of the
  // stop, travel grows by one hole step per pulse, and no digit needs a full turn.
  it('[P3][Req 1.1] travel to the stop grows by one hole step per pulse and stays under a full turn', () => {
    fc.assert(
      fc.property(digitArb, (d: Digit) => {
        const travel = travelDegrees(d);
        const fromAngles = (STOP_ANGLE - HOLE_ANGLES[d] + 360) % 360;
        return travel === fromAngles && travel > 0 && travel < 360;
      }),
    );
    fc.assert(
      fc.property(digitArb, digitArb, (a: Digit, b: Digit) => {
        const diff = travelDegrees(a) - travelDegrees(b);
        return diff === (PULSES[a] - PULSES[b]) * HOLE_SPACING;
      }),
    );
  });

  it('[Req 1.1] the finger stop sits at the bottom right of the dial', () => {
    expect(STOP_ANGLE).toBeGreaterThan(90);
    expect(STOP_ANGLE).toBeLessThan(180);
  });

  // P4: register only when released within 3 degrees of the stop
  it('[P4][Req 1.1, 1.2] shouldRegister is true within 3 degrees of the stop, false outside', () => {
    fc.assert(
      fc.property(digitArb, fc.double({ min: 0, max: 3, noNaN: true }), (d: Digit, short: number) =>
        shouldRegister(d, short),
      ),
    );
    fc.assert(
      fc.property(
        digitArb,
        fc.double({ min: 3.000001, max: 360, noNaN: true }),
        (d: Digit, short: number) => !shouldRegister(d, short),
      ),
    );
  });

  it('[Req 1.2] shouldRegister rejects unknown digits', () => {
    expect(shouldRegister('x', 0)).toBe(false);
  });

  // P4b: drag accumulation never goes anticlockwise past rest or past the stop
  it('[P4][Req 1.1, 1.3] accumulateRotation always stays between 0 and the digit travel', () => {
    fc.assert(
      fc.property(
        digitArb,
        fc.array(angleArb, { minLength: 1, maxLength: 60 }),
        (d: Digit, path: number[]) => {
          const max = travelDegrees(d);
          let rotation = 0;
          let prev = HOLE_ANGLES[d];
          for (const next of path) {
            rotation = accumulateRotation(rotation, prev, next, max);
            prev = next;
            if (rotation < 0 || rotation > max) return false;
          }
          return true;
        },
      ),
    );
  });

  it('[Req 1.1] accumulateRotation follows a slow clockwise drag all the way round for digit 0', () => {
    const max = travelDegrees('0');
    let rotation = 0;
    let prev = HOLE_ANGLES['0'];
    for (let step = 1; step <= max; step += 1) {
      const next = (HOLE_ANGLES['0'] + step) % 360;
      rotation = accumulateRotation(rotation, prev, next, max);
      prev = next;
    }
    expect(rotation).toBeCloseTo(max, 6);
  });

  it('[Req 1.3] accumulateRotation ignores anticlockwise drag at rest', () => {
    expect(accumulateRotation(0, 100, 90, 120)).toBe(0);
  });

  it('pointerAngle measures degrees clockwise from 12 o clock', () => {
    expect(pointerAngle(0, 0, 0, -10)).toBeCloseTo(0, 6);
    expect(pointerAngle(0, 0, 10, 0)).toBeCloseTo(90, 6);
    expect(pointerAngle(0, 0, 0, 10)).toBeCloseTo(180, 6);
    expect(pointerAngle(0, 0, -10, 0)).toBeCloseTo(270, 6);
  });

  it('digitFromHoleIndex maps 0 to "1" and 9 to "0", and rejects out of range', () => {
    expect(digitFromHoleIndex(0)).toBe('1');
    expect(digitFromHoleIndex(9)).toBe('0');
    expect(() => digitFromHoleIndex(10)).toThrow(RangeError);
  });
});
