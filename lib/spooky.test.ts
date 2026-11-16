import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { isSpookyQuery, SPOOKY_KEYWORDS } from './spooky';

describe('isSpookyQuery', () => {
  it('[Req 7.2] a query with a spooky keyword returns true', () => {
    expect(isSpookyQuery('I need a ghost whisperer in Edenvale')).toBe(true);
  });

  it('[Req 7.2] a plain query returns false', () => {
    expect(isSpookyQuery('someone to fix my geyser tonight in Edenvale')).toBe(false);
  });

  it('[Req 4.11] keyword matching is case-insensitive', () => {
    expect(isSpookyQuery('HAUNTED house cleaners')).toBe(true);
    expect(isSpookyQuery('Midnight Locksmith')).toBe(true);
  });

  it('[P7][Req 7.2] true iff the text contains a keyword, ignoring case', () => {
    const piece = fc.oneof(
      fc.string({ maxLength: 12 }),
      fc.constantFrom(...SPOOKY_KEYWORDS).map((kw) =>
        kw
          .split('')
          .map((c, i) => (i % 2 === 0 ? c.toUpperCase() : c))
          .join(''),
      ),
    );
    fc.assert(
      fc.property(fc.array(piece, { maxLength: 5 }), (pieces) => {
        const text = pieces.join(' ');
        const lower = text.toLowerCase();
        const expected = SPOOKY_KEYWORDS.some((kw) => lower.includes(kw));
        return isSpookyQuery(text) === expected;
      }),
    );
  });
});
