import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { findBrandNames } from '@/lib/brandNames';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import {
  ADVERT,
  ADVERT_DIAL_NUMBER,
  ADVERT_LINES,
  PAGE_H,
  PAGE_W,
  composeBook,
  composeEmptyBook,
  bookFor,
} from './bookContent';

const business = (n: number, overrides: Partial<BusinessResult> = {}): BusinessResult => ({
  id: `b${n}`,
  name: `Plumber ${n} Geyser Works`,
  category: 'plumber',
  suburb: 'Edenvale',
  address: `${n} Hollow Lane`,
  phone: `011 000 ${String(1000 + n)}`,
  dial_number: `6${String(1000 + n).slice(0, 4)}`,
  hours: '24 hours',
  description: 'Geysers',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
  ...overrides,
});

const resident = (n: number): ResidentResult => ({
  id: `r${n}`,
  surname: `Nkosi${n}`,
  initials: 'T',
  suburb: 'Soweto',
  address: `${n} Vilakazi Street`,
  phone: `011 000 ${String(2000 + n)}`,
  dial_number: `7${String(2000 + n).slice(0, 4)}`,
  score: 1,
});

const allEntries = (book: ReturnType<typeof composeBook>) => [
  ...book.left.entries,
  ...book.right.entries,
];

describe('composeBook', () => {
  it('[Req 5.1] prints each business with its exchange number and its 011 number', () => {
    const book = composeBook([business(3)], 'business');
    const mine = allEntries(book).find((p) => p.entry.real);
    expect(mine?.entry.name).toBe('Plumber 3 Geyser Works');
    expect(mine?.entry.exchange).toBe('HO 6-1003');
    expect(mine?.entry.phone).toBe('011 000 1003');
  });

  it('[Req 5.2] boxes the listings that are adverts', () => {
    const book = composeBook([business(1, { is_advert: true }), business(2)], 'business');
    const real = allEntries(book).filter((p) => p.entry.real);
    expect(real.find((p) => p.entry.name.includes(' 1 '))?.entry.boxed).toBe(true);
    expect(real.find((p) => p.entry.name.includes(' 2 '))?.entry.boxed).toBe(false);
  });

  it('[Req 6.1] prints residents as SURNAME Initial in the white pages', () => {
    const book = composeBook([resident(4)], 'white');
    const mine = allEntries(book).find((p) => p.entry.real);
    expect(mine?.entry.name).toBe('NKOSI4 T');
    expect(mine?.entry.address).toBe('4 Vilakazi Street');
  });

  it('[Req 6.1] only residents go in the white pages and only businesses in the business pages', () => {
    const mixed = [business(1), resident(1)];
    expect(allEntries(composeBook(mixed, 'white')).filter((p) => p.entry.real)).toHaveLength(1);
    expect(allEntries(composeBook(mixed, 'business')).filter((p) => p.entry.real)).toHaveLength(1);
  });

  it('[Req 6.2] leaves the advert box and the undertaker out of the white pages', () => {
    expect(composeBook([resident(1)], 'white').advert).toBe(false);
    expect(composeBook([business(1)], 'business').advert).toBe(true);
  });

  it('[Req 6.2] sets the white pages in tighter rows than the business pages', () => {
    const rows = (mode: 'white' | 'business') => {
      const ys = allEntries(composeBook([], mode)).map((p) => p.y);
      return new Set(ys).size;
    };
    expect(rows('white')).toBeGreaterThan(rows('business'));
  });

  it('[Req 5.1] keeps the running heads: letter range and page number', () => {
    const book = composeBook([business(1)], 'business');
    expect(book.left.headRight).toBe('THE DEAD PAGES');
    expect(book.left.headLeft).toMatch(/^[A-Z]{3}-[A-Z]{3}$/);
    expect(book.right.headLeft).toMatch(/^\d+$/);
  });

  it('[Req 7.3] the Ashgrove advert is an invented name that passes the brand scan', () => {
    const text = [...ADVERT_LINES, ADVERT_DIAL_NUMBER].join(' ');
    expect(text).toContain('ASHGROVE');
    expect(findBrandNames(text)).toEqual([]);
    expect(ADVERT_DIAL_NUMBER).toBe('AS 2-1000');
  });

  it('[Req 5.1] the same results always make the same book', () => {
    const results = [business(1), business(2)];
    expect(composeBook(results, 'business')).toEqual(composeBook(results, 'business'));
  });

  it('[Req 5.1] never crosses out a real result in red pen', () => {
    const book = composeBook([business(1), business(2), business(3)], 'business');
    expect(allEntries(book).some((p) => p.entry.real && p.entry.crossed)).toBe(false);
  });

  it('[Req 5.1] the filler passes the brand scan', () => {
    const text = allEntries(composeBook([], 'business'))
      .map((p) => `${p.entry.name} ${p.entry.address}`)
      .join(' ');
    expect(findBrandNames(text)).toEqual([]);
  });

  it('[Req 5.1] every placed entry sits inside the page and the advert sits below the columns', () => {
    const book = composeBook([business(1)], 'business');
    for (const p of allEntries(book)) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x + p.width).toBeLessThanOrEqual(PAGE_W);
      expect(p.y).toBeLessThan(PAGE_H);
    }
    const lowest = Math.max(...book.left.entries.map((p) => p.y));
    expect(lowest).toBeLessThan(ADVERT.y);
  });

  it('[Req 5.1] shows every real result for any search of up to 14 listings', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 14 }),
        fc.constantFrom('business' as const, 'white' as const),
        (count, mode) => {
          const results =
            mode === 'white'
              ? Array.from({ length: count }, (_, i) => resident(i))
              : Array.from({ length: count }, (_, i) => business(i));
          const real = allEntries(composeBook(results, mode)).filter((p) => p.entry.real);
          expect(real).toHaveLength(count);
        },
      ),
      { numRuns: 30 },
    );
  });
});
describe('the empty book', () => {
  it('[Req 9.9] has no entries and no advert on either page, in both sections', () => {
    for (const mode of ['business', 'white'] as const) {
      const book = composeEmptyBook(mode);
      expect(book.empty).toBe(true);
      expect(allEntries(book)).toHaveLength(0);
      expect(book.advert).toBe(false);
    }
  });
  it('[Req 9.9] is used when the open section has nothing to show, and not otherwise', () => {
    expect(bookFor([], 'business').empty).toBe(true);
    expect(bookFor([], 'white').empty).toBe(true);
    expect(bookFor([resident(1)], 'business').empty).toBe(true);
    expect(bookFor([business(1)], 'business').empty).toBe(false);
    expect(composeBook([business(1)], 'business').empty).toBe(false);
  });
});
describe('the white pages fill both pages', () => {
  it('[Req 6.1] fills all three columns of the left and right pages with entries', () => {
    const book = composeBook([resident(1), resident(2)], 'white');
    for (const page of [book.left, book.right]) {
      const columns = new Set(page.entries.map((p) => p.x));
      expect(columns.size).toBe(3);
      for (const x of columns) {
        expect(page.entries.filter((p) => p.x === x).length).toBeGreaterThanOrEqual(20);
      }
    }
  });
  it('[Req 6.1] every filler entry is a SURNAME Initial with an address and a number', () => {
    const fillers = allEntries(composeBook([], 'white'));
    for (const { entry } of fillers) {
      expect(entry.name).toMatch(/^[A-Z' &-]+ [A-Za-z]+/);
      expect(entry.address).not.toBe('');
      expect(entry.exchange).not.toBe('');
    }
  });
});
