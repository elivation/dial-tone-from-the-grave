import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { findBrandNames } from './brandNames';
import {
  INCOMING_MESSAGES,
  RING_IN_DEFAULTS,
  incomingReadingMs,
  pickWaitMs,
  readRingInConfig,
} from './incoming';

const sentences = (text: string) => text.match(/[.!?]+(?=\s|$)/g)?.length ?? 0;

describe('incoming messages', () => {
  it('[Req 12.6] has about a dozen lines', () => {
    expect(INCOMING_MESSAGES.length).toBeGreaterThanOrEqual(10);
    expect(INCOMING_MESSAGES.length).toBeLessThanOrEqual(14);
  });
  it('[Req 12.2] every line is one or two sentences', () => {
    for (const line of INCOMING_MESSAGES) {
      expect(sentences(line), line).toBeGreaterThanOrEqual(1);
      expect(sentences(line), line).toBeLessThanOrEqual(2);
    }
  });
  it('[Req 12.6] no line names a real brand', () => {
    for (const line of INCOMING_MESSAGES) expect(findBrandNames(line), line).toEqual([]);
  });
  it('[Req 12.6] no line uses a dash, and no two lines repeat', () => {
    for (const line of INCOMING_MESSAGES) expect(line, line).not.toMatch(/[\u2013\u2014]/);
    expect(new Set(INCOMING_MESSAGES).size).toBe(INCOMING_MESSAGES.length);
  });
});

describe('ring in settings', () => {
  it('[Req 12.1] uses 45 to 120 seconds and 2 calls when nothing is set', () => {
    expect(readRingInConfig({})).toEqual({
      enabled: true,
      minS: 45,
      maxS: 120,
      maxPerSession: 2,
    });
    expect(RING_IN_DEFAULTS.minS).toBe(45);
  });
  it('[Req 12.7] only the exact word false switches it off', () => {
    expect(readRingInConfig({ enabled: 'false' }).enabled).toBe(false);
    expect(readRingInConfig({ enabled: 'true' }).enabled).toBe(true);
    expect(readRingInConfig({ enabled: 'nope' }).enabled).toBe(true);
  });
  it('[Req 12.1] reads the wait and the cap from the settings', () => {
    expect(readRingInConfig({ minS: '2', maxS: '5', maxPerSession: '3' })).toMatchObject({
      minS: 2,
      maxS: 5,
      maxPerSession: 3,
    });
  });
  it('[Req 12.1] falls back to the defaults for rubbish, and never lets max fall below min', () => {
    expect(readRingInConfig({ minS: 'abc', maxS: '-4', maxPerSession: '' })).toMatchObject({
      minS: 45,
      maxS: 120,
      maxPerSession: 2,
    });
    expect(readRingInConfig({ minS: '50', maxS: '10' })).toMatchObject({ minS: 50, maxS: 50 });
  });
  it('[Req 12.1] the wait is always between the minimum and the maximum', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        (min, extra, random) => {
          const ms = pickWaitMs(min, min + extra, random);
          return ms >= min * 1000 && ms <= (min + extra) * 1000;
        },
      ),
    );
  });
  it('[Req 12.2] gives a long line more reading time when it is not spoken', () => {
    expect(incomingReadingMs('Hi.')).toBeGreaterThanOrEqual(4000);
    expect(incomingReadingMs('x'.repeat(200))).toBeGreaterThan(incomingReadingMs('x'.repeat(50)));
  });
});
