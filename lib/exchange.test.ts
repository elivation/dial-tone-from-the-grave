import { describe, it, expect } from 'vitest';
import { EXCHANGES, exchangeOf, formatDialNumber } from './exchange';

describe('exchange-style numbers', () => {
  it('[Req 11.1] prints a short number the way an old directory did', () => {
    expect(formatDialNumber('61001')).toBe('HO 6-1001');
  });

  it('names an exchange for every first digit a short number can have', () => {
    for (const first of '23456789') {
      const exchange = exchangeOf(`${first}0000`);
      expect(exchange, first).not.toBeNull();
      expect(exchange?.code, first).toMatch(/^[A-Z]{2}$/);
      expect(exchange?.name.toUpperCase().startsWith(exchange?.code ?? '?'), first).toBe(true);
    }
    expect(new Set(Object.values(EXCHANGES).map((e) => e.code)).size).toBe(
      Object.keys(EXCHANGES).length,
    );
  });

  it('leaves anything that is not a short number as it is', () => {
    expect(formatDialNumber('011 000 1001')).toBe('011 000 1001');
    expect(formatDialNumber('1023')).toBe('1023');
  });
});
