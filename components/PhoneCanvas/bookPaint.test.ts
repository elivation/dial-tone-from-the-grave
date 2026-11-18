import { describe, it, expect } from 'vitest';
import { composeBook, composeEmptyBook, PAGE_H, PAGE_W, type BookLayout } from './bookContent';
import { paintPage, type CanvasFactory, type PageMarks } from './bookPaint';
import { FIXTURE_BUSINESSES } from './__fixtures__/book';
import type { BusinessResult } from '@/lib/listingSearch';

type Log = { texts: string[]; calls: string[] };

/** A 2D context that records what is drawn. jsdom has no canvas of its own. */
function fakeContext(log: Log): CanvasRenderingContext2D {
  const state: Record<string, unknown> = {};
  return new Proxy(state, {
    get: (t, key: string) => {
      if (key in t) return t[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient')
        return () => ({ addColorStop: () => {} });
      if (key === 'getImageData' || key === 'createImageData')
        return (_x: number, _y: number, w: number, h: number) => ({
          data: new Uint8ClampedArray(w * h * 4),
        });
      if (key === 'measureText') return () => ({ width: 40 });
      if (key === 'fillText')
        return (text: string) => {
          log.texts.push(text);
          log.calls.push(`fillText:${text}`);
        };
      return (...args: unknown[]) => {
        log.calls.push(`${key}:${args.length}`);
      };
    },
    set: (t, key: string, value) => {
      t[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

function run(
  section: 'business' | 'white',
  side: 'L' | 'R',
  results: BusinessResult[] = [],
  book: BookLayout = composeBook(results, section),
  marks?: PageMarks,
) {
  const log: Log = { texts: [], calls: [] };
  const create: CanvasFactory = (width, height) =>
    ({ width, height, getContext: () => fakeContext(log) }) as unknown as HTMLCanvasElement;
  const canvas = paintPage(create, book, side, marks);
  return { log, canvas };
}

const listing: BusinessResult = {
  id: 'b1',
  name: 'Abacus Geysers',
  category: 'plumber',
  suburb: 'Edenvale',
  address: '1 Hollow Lane',
  phone: '011 000 1001',
  dial_number: '61001',
  hours: '24 hours',
  description: 'Geysers',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
};

describe('paintPage', () => {
  it('[Req 5.1] paints a portrait page canvas', () => {
    const { canvas } = run('business', 'L');
    expect(canvas.width).toBe(PAGE_W);
    expect(canvas.height).toBe(PAGE_H);
  });

  it('[Req 5.1] prints the listing, its exchange number and its 011 number', () => {
    const { log } = run('business', 'L', [listing]);
    const all = log.texts.join('\n');
    expect(all).toContain('Abacus Geysers');
    expect(all).toContain('HO 6-1001');
    expect(all).toContain('011 000 1001');
  });

  it('[Req 5.2] puts the Ashgrove advert on the left business page only', () => {
    expect(run('business', 'L').log.texts.join(' ')).toContain('ASHGROVE & DAUGHTERS');
    expect(run('business', 'R').log.texts.join(' ')).not.toContain('ASHGROVE & DAUGHTERS');
  });

  it('[Req 5.1] writes the handwritten note on the right page', () => {
    const texts = run('business', 'R').log.texts;
    expect(texts).toContain("don't answer if it");
    expect(texts).toContain('rings at 3am');
    expect(run('business', 'L').log.texts).not.toContain('rings at 3am');
  });

  it('[Req 6.2] the white pages have no advert box', () => {
    expect(run('white', 'L').log.texts.join(' ')).not.toContain('ASHGROVE & DAUGHTERS');
  });

  it('[Req 5.1] paints the same page every time because the PRNG is seeded', () => {
    expect(run('business', 'R').log.calls).toEqual(run('business', 'R').log.calls);
  });

  it('[Req 5.1] draws the print layer twice, once blurred and once sharp', () => {
    const filters = run('business', 'L').log.calls.filter((c) => c.startsWith('drawImage'));
    expect(filters.length).toBe(2);
  });
});
describe('paintPage with no listings', () => {
  it('[Req 9.9] prints the no listings message on the left page, not a blank page', () => {
    const { log } = run('business', 'L', [], composeEmptyBook('business'));
    expect(log.texts.join(' ')).toContain('No listings found');
    expect(log.texts.join(' ')).toContain('in this exchange.');
  });
  it('[Req 9.9] leaves out the Ashgrove advert and keeps the handwritten note', () => {
    expect(
      run('business', 'L', [], composeEmptyBook('business')).log.texts.join(' '),
    ).not.toContain('ASHGROVE');
    expect(run('white', 'R', [], composeEmptyBook('white')).log.texts).toContain('rings at 3am');
  });
  it('[Req 9.9] prints no message on a page of listings', () => {
    expect(run('business', 'L', [listing]).log.texts.join(' ')).not.toContain('No listings found');
  });
});

describe('paintPage marks', () => {
  const layout = composeBook(FIXTURE_BUSINESSES, 'business');
  const called = [...layout.left.entries, ...layout.right.entries].find((p) => p.entry.real);
  const calledId = called?.entry.id ?? '';
  const calledSide = layout.left.entries.some((p) => p.entry.id === calledId) ? 'L' : 'R';
  const otherSide = calledSide === 'L' ? 'R' : 'L';
  const paint = (side: 'L' | 'R', marks?: PageMarks) =>
    run('business', side, [], layout, marks).log.calls;
  const count = (calls: string[], prefix: string) =>
    calls.filter((c) => c.startsWith(prefix)).length;

  it('[Req 13.3] draws a pencil ring twice round a called listing, on its own page only', () => {
    const marks: PageMarks = { calledIds: [calledId], dogEared: false };
    const plain = paint(calledSide);
    const ringed = paint(calledSide, marks);
    expect(count(ringed, 'stroke:') - count(plain, 'stroke:')).toBe(2);
    expect(paint(otherSide, marks)).toEqual(paint(otherSide));
  });

  it('[Req 13.3] draws no ring for a listing that is not on the page', () => {
    const marks: PageMarks = { calledIds: ['somebody-else'], dogEared: false };
    expect(paint(calledSide, marks)).toEqual(paint(calledSide));
  });

  it('[Req 13.3] never rings the filler, whatever ids are called', () => {
    const marks: PageMarks = { calledIds: [''], dogEared: false };
    expect(paint('L', marks)).toEqual(paint('L'));
    expect(paint('R', marks)).toEqual(paint('R'));
  });

  it('[Req 13.3] folds the outer corner of the right page for a dog-eared page, and not the left', () => {
    const marks: PageMarks = { calledIds: [], dogEared: true };
    expect(paint('R', marks).length).toBeGreaterThan(paint('R').length);
    expect(paint('L', marks)).toEqual(paint('L'));
  });

  it('[Req 13.3] paints the same ring every time because the PRNG is seeded', () => {
    const marks: PageMarks = { calledIds: [calledId], dogEared: true };
    expect(paint(calledSide, marks)).toEqual(paint(calledSide, marks));
  });

  it('[Req 13.3] leaves the rest of the page as it was when marks are added', () => {
    const marks: PageMarks = { calledIds: [calledId], dogEared: true };
    const plain = paint('R');
    const marked = paint('R', marks);
    expect(marked.filter((c) => c.startsWith('fillText'))).toEqual(
      plain.filter((c) => c.startsWith('fillText')),
    );
  });
});
