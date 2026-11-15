import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { DIGITS, PULSES, PULSE_INTERVAL_MS, returnDuration, travelDegrees } from '@/lib/dial';
import { returnSpeed, stepShown } from './dialMotion';

const angle = fc.double({ min: 0, max: 330, noNaN: true });
const frame = fc.double({ min: 0.001, max: 0.1, noNaN: true });

describe('[Req 1.3] returnSpeed', () => {
  it('brings the wheel home in exactly one pulse interval per pulse', () => {
    for (const digit of DIGITS) {
      const seconds = travelDegrees(digit) / returnSpeed(digit);
      expect(seconds * 1000).toBeCloseTo(returnDuration(digit), 6);
      expect(seconds * 1000).toBeCloseTo(PULSES[digit] * PULSE_INTERVAL_MS, 6);
    }
  });
});

describe('stepShown', () => {
  const base = { reducedMotion: false, returnSpeed: 200 };

  it('follows the finger exactly while dragging', () => {
    expect(stepShown({ ...base, phase: 'dragging', shown: 10, target: 90, dt: 0.016 })).toBe(90);
  });

  it('[Req 1.8] jumps straight to the target for people who ask for less motion', () => {
    for (const phase of ['returning', 'springing'] as const) {
      expect(
        stepShown({ ...base, reducedMotion: true, phase, shown: 120, target: 60, dt: 0.016 }),
      ).toBe(60);
    }
  });

  it('runs straight back to rest at a constant speed, whatever the stepped target says', () => {
    fc.assert(
      fc.property(angle, angle, frame, (shown, target, dt) => {
        const next = stepShown({ ...base, phase: 'returning', shown, target, dt });
        return Math.abs(next - Math.max(0, shown - base.returnSpeed * dt)) < 1e-9;
      }),
    );
  });

  it('springs back without overshooting', () => {
    fc.assert(
      fc.property(angle, frame, (shown, dt) => {
        const next = stepShown({ ...base, phase: 'springing', shown, target: 0, dt });
        return next >= 0 && next <= shown + 1e-9;
      }),
    );
  });

  it('gets there: repeated steps reach the target', () => {
    let shown = 300;
    for (let i = 0; i < 400; i++)
      shown = stepShown({ ...base, phase: 'returning', shown, target: 150, dt: 1 / 60 });
    expect(shown).toBe(0);
    shown = 300;
    for (let i = 0; i < 400; i++)
      shown = stepShown({ ...base, phase: 'springing', shown, target: 0, dt: 1 / 60 });
    expect(shown).toBeLessThan(0.01);
  });
});
