// @vitest-environment node
/**
 * [Req 4.1, 5.1, 5.2, 6.3, 7.1, 11.1] The seed data for The Dead Pages: invented businesses and
 * residents, each with its own fictional number.
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { findBrandNames } from '@/lib/brandNames';
import { EMERGENCY_NUMBERS, OPERATORS } from '@/lib/operators';
import { BUSINESSES } from './businesses';
import { RESIDENTS } from './residents';
import { embeddingText } from './rows';

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
