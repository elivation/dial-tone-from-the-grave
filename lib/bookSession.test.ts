import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import {
  BOOK_MAX_PAGES,
  addPage,
  emptySession,
  flipPage,
  markCalled,
  markDialled,
  parseSession,
  serialiseSession,
  type BookSession,
} from './bookSession';

const business = (n: number): BusinessResult => ({
  id: `b${n}`,
  name: `Business ${n}`,
  category: 'plumber',
  suburb: 'Edenvale',
  address: `${n} Hollow Lane`,
  phone: `011 000 ${1000 + n}`,
  dial_number: `${61000 + n}`,
  hours: '24 hours',
  description: 'Invented',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
});

const resident = (n: number): ResidentResult => ({
  id: `r${n}`,
  surname: 'Dlamini',
  initials: 'T',
  suburb: 'Soweto',
  address: `${n} Fixture Street`,
  phone: `011 000 ${2000 + n}`,
  dial_number: `${72000 + n}`,
  score: 1,
});

const search = (session: BookSession, n: number, query = `q${n}`) =>
  addPage(session, { query, results: [business(n)] });

describe('addPage', () => {
  it('[Req 13.1] adds one page per search and shows it', () => {
    const one = search(emptySession, 1);
    const two = search(one, 2);
    expect(two.pages.map((p) => p.query)).toEqual(['q1', 'q2']);
    expect(two.current).toBe(1);
    expect(two.pages[1]).toMatchObject({ section: 'business', calledIds: [], dogEared: false });
  });

  it('[Req 13.1] puts residents in the white section', () => {
    const session = addPage(emptySession, { query: 'Dlamini', results: [resident(1)] });
    expect(session.pages[0]?.section).toBe('white');
  });

  it('[Req 13.1] adds no page for a search that found nothing', () => {
    expect(addPage(emptySession, { query: 'nothing', results: [] })).toBe(emptySession);
  });

  it('[Req 13.1] keeps BOOK_MAX_PAGES pages and drops the oldest first', () => {
    expect(BOOK_MAX_PAGES).toBe(12);
    let session = emptySession;
    for (let n = 1; n <= BOOK_MAX_PAGES + 3; n++) session = search(session, n);
    expect(session.pages).toHaveLength(BOOK_MAX_PAGES);
    expect(session.pages[0]?.query).toBe('q4');
    expect(session.pages.at(-1)?.query).toBe(`q${BOOK_MAX_PAGES + 3}`);
    expect(session.current).toBe(BOOK_MAX_PAGES - 1);
  });

  it('[Req 13.1] gives every page its own id, even after old pages are dropped', () => {
    let session = emptySession;
    for (let n = 1; n <= BOOK_MAX_PAGES + 3; n++) session = search(session, n);
    expect(new Set(session.pages.map((p) => p.id)).size).toBe(session.pages.length);
  });
});

describe('markCalled', () => {
  it('[Req 13.3] circles the listing and dog-ears its page, and only that page', () => {
    const session = markCalled(search(search(emptySession, 1), 2), 'b1');
    expect(session.pages[0]).toMatchObject({ calledIds: ['b1'], dogEared: true });
    expect(session.pages[1]).toMatchObject({ calledIds: [], dogEared: false });
  });

  it('[Req 13.3] marks the listing on every page it appears on', () => {
    const session = markCalled(search(search(emptySession, 1, 'a'), 1, 'b'), 'b1');
    expect(session.pages.map((p) => p.dogEared)).toEqual([true, true]);
  });

  it('[Req 13.3] leaves the session alone for a listing that is not in the book, or already called', () => {
    const session = markCalled(search(emptySession, 1), 'b1');
    expect(markCalled(session, 'nobody')).toBe(session);
    expect(markCalled(session, 'b1')).toBe(session);
  });

  it('[Req 13.3] finds a listing by the number that was dialled', () => {
    const session = markDialled(search(emptySession, 1), '61001');
    expect(session.pages[0]?.calledIds).toEqual(['b1']);
    expect(markDialled(session, '99999')).toBe(session);
  });
});

describe('flipPage', () => {
  it('[Req 13.2] moves back and forward and stops at either end', () => {
    const session = search(search(search(emptySession, 1), 2), 3);
    expect(flipPage(session, -1).current).toBe(1);
    expect(flipPage(flipPage(session, -1), 1).current).toBe(2);
    expect(flipPage(session, 1)).toBe(session);
    expect(flipPage(flipPage(flipPage(session, -1), -1), -1).current).toBe(0);
    expect(flipPage(emptySession, -1)).toBe(emptySession);
  });
});

describe('stored session', () => {
  it('[Req 13.4] survives a round trip through its stored text', () => {
    const session = markCalled(search(search(emptySession, 1), 2), 'b2');
    expect(parseSession(serialiseSession(session))).toEqual(session);
  });

  it.each([
    ['nothing stored', null],
    ['text that is not JSON', '{nope'],
    ['JSON of the wrong shape', '[1,2,3]'],
    ['pages that are not an array', '{"pages":"x","current":0,"nextId":1}'],
    [
      'a listing missing its fields',
      '{"pages":[{"id":"p1","section":"business","query":"q","results":[{"id":"x"}],"calledIds":[],"dogEared":false}],"current":0,"nextId":2}',
    ],
  ])('[Req 13.4] starts an empty book for %s', (_label, raw) => {
    expect(parseSession(raw)).toEqual(emptySession);
  });

  it('[Req 13.4] clamps a stored page number that is out of range and trims an over-long book', () => {
    let session = emptySession;
    for (let n = 1; n <= BOOK_MAX_PAGES + 2; n++) session = search(session, n);
    const stored = JSON.stringify({
      ...session,
      current: 99,
      pages: [...session.pages, ...session.pages],
    });
    const parsed = parseSession(stored);
    expect(parsed.pages).toHaveLength(BOOK_MAX_PAGES);
    expect(parsed.current).toBe(BOOK_MAX_PAGES - 1);
  });
});

type Op =
  | { kind: 'search'; ids: number[] }
  | { kind: 'call'; id: number }
  | { kind: 'flip'; by: -1 | 1 };

const opArbitrary: fc.Arbitrary<Op> = fc.oneof(
  fc.record({
    kind: fc.constant('search' as const),
    ids: fc.uniqueArray(fc.integer({ min: 0, max: 9 }), { minLength: 0, maxLength: 4 }),
  }),
  fc.record({ kind: fc.constant('call' as const), id: fc.integer({ min: 0, max: 9 }) }),
  fc.record({ kind: fc.constant('flip' as const), by: fc.constantFrom(-1 as const, 1 as const) }),
);

describe('the session book', () => {
  it('[P15] [Req 13.1, 13.3] never holds more than BOOK_MAX_PAGES, drops the oldest first, and marks only dialled listings', () => {
    fc.assert(
      fc.property(fc.array(opArbitrary, { maxLength: 60 }), (ops) => {
        let session = emptySession;
        const searches: string[] = [];
        const dialled = new Set<string>();
        ops.forEach((op, i) => {
          if (op.kind === 'search') {
            const query = `q${i}`;
            session = addPage(session, { query, results: op.ids.map(business) });
            if (op.ids.length > 0) searches.push(query);
          } else if (op.kind === 'call') {
            dialled.add(`b${op.id}`);
            session = markCalled(session, `b${op.id}`);
          } else {
            session = flipPage(session, op.by);
          }
        });
        expect(session.pages.length).toBeLessThanOrEqual(BOOK_MAX_PAGES);
        expect(session.pages.map((p) => p.query)).toEqual(searches.slice(-BOOK_MAX_PAGES));
        expect(session.current).toBeGreaterThanOrEqual(Math.min(0, session.pages.length - 1));
        expect(session.current).toBeLessThan(Math.max(1, session.pages.length));
        for (const page of session.pages) {
          const present = new Set(page.results.map((r) => r.id));
          expect(page.calledIds.every((id) => dialled.has(id) && present.has(id))).toBe(true);
          expect(page.dogEared).toBe(page.calledIds.length > 0);
        }
      }),
    );
  });
});
