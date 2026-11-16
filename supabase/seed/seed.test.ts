// @vitest-environment node
/**
 * [Req 4.1, 5.1, 5.2, 6.3, 7.1, 11.1] The seed data for The Dead Pages: invented businesses and
 * residents, each with its own fictional number.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { findBrandNames } from '@/lib/brandNames';
import { conflictsWithReserved, isShortDialNumber, RESERVED_NUMBERS } from '@/lib/dialPlan';
import { formatDialNumber } from '@/lib/exchange';
import { EMERGENCY_NUMBERS, OPERATORS } from '@/lib/operators';
import { BUSINESSES } from './businesses';
import { RESIDENTS } from './residents';
import { embeddingText } from './rows';
import { TWIST } from './twists';

const digitsOf = (phone: string) => phone.replace(/\D/g, '');
const allNumbers = [...BUSINESSES.map((b) => b.phone), ...RESIDENTS.map((r) => r.phone)];

describe('business listings', () => {
  it('[Req 4.1] has at least 150 ordinary businesses and about 12 spirit listings', () => {
    expect(BUSINESSES.filter((b) => !b.is_spirit).length).toBeGreaterThanOrEqual(150);
    const spirits = BUSINESSES.filter((b) => b.is_spirit).length;
    expect(spirits).toBeGreaterThanOrEqual(12);
    expect(spirits).toBeLessThanOrEqual(14);
  });

  it('[Req 5.2] boxes some of them as adverts, but not too many', () => {
    const adverts = BUSINESSES.filter((b) => b.is_advert).length;
    expect(adverts).toBeGreaterThanOrEqual(10);
    expect(adverts).toBeLessThanOrEqual(25);
  });

  it('[Req 5.1] gives every listing a name, trade, suburb, address, number, hours and a short description', () => {
    for (const b of BUSINESSES) {
      for (const field of [
        'name',
        'category',
        'suburb',
        'address',
        'phone',
        'hours',
        'description',
      ] as const) {
        expect(b[field].trim(), `${b.name}: ${field}`).not.toBe('');
      }
      expect(b.description.length, b.name).toBeLessThanOrEqual(140);
    }
  });

  it('marks a business open 24 hours exactly when its hours say so', () => {
    for (const b of BUSINESSES) expect(b.is_24hr, b.name).toBe(/24 hours/i.test(b.hours));
  });

  it('never gives two businesses the same name', () => {
    expect(new Set(BUSINESSES.map((b) => b.name)).size).toBe(BUSINESSES.length);
  });
});

describe('resident listings', () => {
  it('[Req 6.3] has at least 80 invented residents', () => {
    expect(RESIDENTS.length).toBeGreaterThanOrEqual(80);
  });

  it('[Req 6.1] gives every resident a surname, initials, address, suburb and number', () => {
    for (const r of RESIDENTS) {
      for (const field of ['surname', 'initials', 'address', 'suburb', 'phone'] as const) {
        expect(r[field].trim(), `${r.surname}: ${field}`).not.toBe('');
      }
      expect(r.initials, r.surname).toMatch(/^[A-Z]( [A-Z])*$/);
    }
  });

  it('[Req 4.2] includes surnames that differ only a little, to exercise fuzzy matching', () => {
    const surnames = new Set(RESIDENTS.map((r) => r.surname));
    expect(surnames.has('van der Merwe')).toBe(true);
    expect(surnames.has('Van der Merwe') || surnames.has('Vandermerwe')).toBe(true);
    expect([...surnames].filter((s) => /^Bot/.test(s)).length).toBeGreaterThanOrEqual(2);
  });
});

describe('numbers', () => {
  it('[P14] [Req 11.1] gives every listing its own number: no two the same, across both sections', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: allNumbers.length - 1 }),
        fc.integer({ min: 0, max: allNumbers.length - 1 }),
        (i, j) =>
          i === j || digitsOf(allNumbers[i] as string) !== digitsOf(allNumbers[j] as string),
      ),
      { numRuns: 2000 },
    );
    // And checked in full, so nothing is left to chance.
    expect(new Set(allNumbers.map(digitsOf)).size).toBe(allNumbers.length);
  });

  it('[P14] [Req 6.3, 11.1] keeps every number in the fictional 011 000 xxxx range, printed the same way', () => {
    for (const phone of allNumbers) expect(phone).toMatch(/^011 000 \d{4}$/);
  });

  it('[P14] [Req 11.1] never uses an operator number or an emergency number', () => {
    for (const phone of allNumbers) {
      const digits = digitsOf(phone);
      expect(EMERGENCY_NUMBERS.has(digits), phone).toBe(false);
      expect(digits in OPERATORS, phone).toBe(false);
    }
  });
});

describe('short dial numbers', () => {
  const short = [...BUSINESSES.map((b) => b.dial_number), ...RESIDENTS.map((r) => r.dial_number)];

  it('[P14] [Req 11.1] gives every listing a five-digit dial number, no two the same across businesses, spirits and residents', () => {
    for (const n of short) expect(n).toMatch(/^\d{5}$/);
    expect(new Set(short).size).toBe(short.length);
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: short.length - 1 }),
        fc.integer({ min: 0, max: short.length - 1 }),
        (i, j) => i === j || short[i] !== short[j],
      ),
      { numRuns: 2000 },
    );
  });

  it('[P14] [Req 2.8, 11.1] never uses, starts with, or is the start of an operator or emergency number', () => {
    for (const n of short) {
      expect(isShortDialNumber(n), n).toBe(true);
      expect(conflictsWithReserved(n), n).toBe(false);
      for (const reserved of RESERVED_NUMBERS) {
        expect(n.startsWith(reserved) || reserved.startsWith(n), `${n} and ${reserved}`).toBe(
          false,
        );
      }
    }
    for (const n of ['1023', '1026', '666', '1313', ...EMERGENCY_NUMBERS])
      expect(short).not.toContain(n);
  });

  it('never lets a dial number be mistaken for the start of an 011 number', () => {
    for (const n of short) expect(n.startsWith('0')).toBe(false);
  });

  it('[Req 11.1] prints every dial number in exchange style', () => {
    for (const n of short) expect(formatDialNumber(n), n).toMatch(/^[A-Z]{2} \d-\d{4}$/);
    expect(formatDialNumber(BUSINESSES[0]?.dial_number ?? '')).toBe('HO 6-1001');
  });
});

describe('business names', () => {
  it('give every ordinary business a Dead Pages twist no real firm would use', () => {
    for (const b of BUSINESSES.filter((x) => !x.is_spirit)) expect(b.name, b.name).toMatch(TWIST);
  });

  it('keep names short enough for a directory column', () => {
    for (const b of BUSINESSES) expect(b.name.length, b.name).toBeLessThanOrEqual(72);
  });
});

describe('spirit listings', () => {
  it('[Req 7.1] are spooky businesses', () => {
    for (const s of BUSINESSES.filter((b) => b.is_spirit)) {
      expect(`${s.name} ${s.description}`, s.name).toMatch(
        /ghost|haunt|spirit|s[eé]ance|grave|coffin|crypt|midnight|beyond|dead|phantom|spectr|wraith|tomb|cemetery|poltergeist|afterlife/i,
      );
    }
  });
});

describe('content rules', () => {
  it('names no real directory, telecom or phone company anywhere in the seed data', () => {
    expect(findBrandNames(JSON.stringify({ BUSINESSES, RESIDENTS }))).toEqual([]);
  });
});

describe('embeddingText', () => {
  it('[Req 4.1] describes a business by its name, trade, suburb and description, for meaning-based search', () => {
    const b = BUSINESSES[0];
    if (!b) throw new Error('no businesses');
    const text = embeddingText({ kind: 'business', row: b });
    for (const part of [b.name, b.category, b.suburb, b.description]) expect(text).toContain(part);
  });

  it('[Req 4.2] describes a resident by surname, initials and suburb', () => {
    const r = RESIDENTS[0];
    if (!r) throw new Error('no residents');
    const text = embeddingText({ kind: 'resident', row: r });
    for (const part of [r.surname, r.initials, r.suburb]) expect(text).toContain(part);
  });
});
