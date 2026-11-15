import { describe, it, expect } from 'vitest';
import { HOLE_ANGLES, PULSES, travelDegrees } from '@/lib/dial';
import { replayPlan } from './replay';

describe('replayPlan', () => {
  const plan = replayPlan('1023');

  it('drags each digit, in order, from its hole all the way to the stop, then lets go', () => {
    const grabs = plan.filter((s) => s.kind === 'grab').map((s) => s.digit);
    expect(grabs).toEqual(['1', '0', '2', '3']);
    for (const digit of ['1', '0', '2', '3'] as const) {
      const mine = plan.filter((s) => s.digit === digit);
      expect(mine[0]?.kind).toBe('grab');
      expect(mine[0]?.angle).toBe(HOLE_ANGLES[digit]);
      expect(mine.at(-1)?.kind).toBe('release');
      const drags = mine.filter((s) => s.kind === 'drag');
      expect(drags.length).toBeGreaterThan(5);
      expect(drags.at(-1)?.angle).toBe(HOLE_ANGLES[digit] + travelDegrees(digit));
    }
  });

  it('gives the dial time to run back before the next digit, and keeps time moving forward', () => {
    for (let i = 1; i < plan.length; i++) {
      expect((plan[i]?.at ?? 0) >= (plan[i - 1]?.at ?? 0)).toBe(true);
    }
    const release = plan.find((s) => s.kind === 'release' && s.digit === '0');
    const next = plan.find((s) => s.kind === 'grab' && s.digit === '2');
    expect((next?.at ?? 0) - (release?.at ?? 0)).toBeGreaterThan(PULSES['0'] * 100);
  });

  it('ignores anything that is not a digit', () => {
    expect(replayPlan('1a-0').filter((s) => s.kind === 'grab')).toHaveLength(2);
  });
});
