import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { EMERGENCY_NUMBERS } from './operators';
import {
  OPERATOR_NUMBERS,
  RESERVED_NUMBERS,
  conflictsWithReserved,
  isShortDialNumber,
} from './dialPlan';

const digit = fc.constantFrom(...'0123456789'.split(''));
const digits = (min: number, max: number) =>
  fc.array(digit, { minLength: min, maxLength: max }).map((d) => d.join(''));

describe('the dial plan', () => {
  it('[Req 2.8, 11.1] reserves every operator number and every emergency number', () => {
    for (const n of ['1023', '1026', '666', '1313']) expect(OPERATOR_NUMBERS).toContain(n);
    for (const n of [...OPERATOR_NUMBERS, ...EMERGENCY_NUMBERS])
      expect(RESERVED_NUMBERS).toContain(n);
  });

  it('[Req 11.1] calls any number that starts with a reserved number a conflict', () => {
    fc.assert(
      fc.property(fc.constantFrom(...RESERVED_NUMBERS), digits(0, 6), (reserved, tail) =>
        conflictsWithReserved(reserved + tail),
      ),
    );
  });

  it('[Req 11.1] calls any number that a reserved number starts with a conflict, so neither can cut the other off', () => {
    fc.assert(
      fc.property(fc.constantFrom(...RESERVED_NUMBERS), (reserved) =>
        Array.from({ length: reserved.length }, (_, i) => reserved.slice(0, i + 1)).every(
          conflictsWithReserved,
        ),
      ),
    );
  });

  it('accepts a number that shares no prefix with any reserved number', () => {
    expect(conflictsWithReserved('61001')).toBe(false);
    expect(conflictsWithReserved('31301')).toBe(false);
    expect(conflictsWithReserved('66601')).toBe(true);
    expect(conflictsWithReserved('91100')).toBe(true);
    expect(conflictsWithReserved('10230')).toBe(true);
  });

  it('[Req 11.1] keeps short dial numbers to five digits, starting 2 to 9, clear of every reserved number', () => {
    fc.assert(
      fc.property(
        digits(1, 7),
        (n) => isShortDialNumber(n) === (/^[2-9]\d{4}$/.test(n) && !conflictsWithReserved(n)),
      ),
    );
  });
});
