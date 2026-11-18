import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import { FIXTURE_BUSINESSES, FIXTURE_RESIDENTS } from './__fixtures__/book';
import { PAGE_H, PAGE_W, bookFor, composeEmptyBook } from './bookContent';
import { hitsFor, listingAt, type PageHit } from './bookHits';

const many = (count: number): BusinessResult[] =>
  Array.from({ length: count }, (_, n) => ({
    ...(FIXTURE_BUSINESSES[0] as BusinessResult),
    id: `many-${n}`,
    name: `Listing ${String(n).padStart(2, '0')}`,
    is_advert: n % 5 === 0,
  }));

const uv = (x: number, y: number) => ({ u: x / PAGE_W, v: 1 - y / PAGE_H });

describe('hitsFor', () => {
  it('[Req 13.2] records one rectangle for each real listing and none for the filler', () => {
    const hits = hitsFor(bookFor(FIXTURE_BUSINESSES, 'business'));
    const ids = [...hits.left, ...hits.right].map((hit) => hit.id).sort();
    expect(ids).toEqual(FIXTURE_BUSINESSES.map((b) => b.id).sort());
  });

  it('[Req 13.2] records residents on the white pages', () => {
    const hits = hitsFor(bookFor(FIXTURE_RESIDENTS, 'white'));
    const ids = [...hits.left, ...hits.right].map((hit) => hit.id).sort();
    expect(ids).toEqual((FIXTURE_RESIDENTS as ResidentResult[]).map((r) => r.id).sort());
  });

  it('[Req 13.2] records nothing for the empty book', () => {
    expect(hitsFor(composeEmptyBook('business'))).toEqual({ left: [], right: [] });
  });

  it('[Req 13.2] keeps every rectangle inside the page, in UV space', () => {
    const hits = hitsFor(bookFor(many(14), 'business'));
    for (const hit of [...hits.left, ...hits.right]) {
      expect(hit.u0).toBeGreaterThanOrEqual(0);
      expect(hit.u1).toBeLessThanOrEqual(1);
      expect(hit.v0).toBeGreaterThanOrEqual(0);
      expect(hit.v1).toBeLessThanOrEqual(1);
      expect(hit.u0).toBeLessThan(hit.u1);
      expect(hit.v0).toBeLessThan(hit.v1);
    }
  });
});

describe('listingAt', () => {
  it('[Req 13.2] finds the listing printed at a point on the page', () => {
    const layout = bookFor(FIXTURE_BUSINESSES, 'business');
    const placed = [...layout.left.entries, ...layout.right.entries].find((p) => p.entry.real);
    if (!placed) throw new Error('fixture has no real listing');
    const hits = layout.left.entries.includes(placed)
      ? hitsFor(layout).left
      : hitsFor(layout).right;
    const { u, v } = uv(placed.x + 20, placed.y);
    expect(listingAt(hits, u, v)).toBe(placed.entry.id);
  });

  it('[Req 13.2] finds nothing in the margin or on the running head', () => {
    const hits = hitsFor(bookFor(FIXTURE_BUSINESSES, 'business'));
    for (const page of [hits.left, hits.right]) {
      expect(listingAt(page, 0.01, 0.5)).toBeNull();
      expect(listingAt(page, 0.5, 0.97)).toBeNull();
    }
  });

  it('[Req 13.2] a point inside a rectangle gives that listing, and a point outside all of them gives none', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 14 }),
        fc.constantFrom('business' as const, 'white' as const),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        fc.double({ min: 0, max: 1, noNaN: true, maxExcluded: true }),
        (count, section, u, v) => {
          const results =
            section === 'white'
              ? (FIXTURE_RESIDENTS as ResidentResult[]).slice(0, Math.min(count, 3))
              : many(count);
          const hits = hitsFor(bookFor(results, section));
          for (const page of [hits.left, hits.right]) {
            const inside = page.filter(
              (hit: PageHit) => u >= hit.u0 && u < hit.u1 && v >= hit.v0 && v < hit.v1,
            );
            // Rectangles never overlap, so there is at most one.
            expect(inside.length).toBeLessThanOrEqual(1);
            expect(listingAt(page, u, v)).toBe(inside[0]?.id ?? null);
          }
          // The centre of every rectangle is its own listing.
          for (const hit of [...hits.left, ...hits.right]) {
            const page = hits.left.includes(hit) ? hits.left : hits.right;
            expect(listingAt(page, (hit.u0 + hit.u1) / 2, (hit.v0 + hit.v1) / 2)).toBe(hit.id);
          }
        },
      ),
    );
  });
});
