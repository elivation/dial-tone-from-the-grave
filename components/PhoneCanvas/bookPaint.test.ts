import { describe, it, expect } from 'vitest';
import { composeBook, composeEmptyBook, PAGE_H, PAGE_W, type BookLayout } from './bookContent';
import { paintPage, type CanvasFactory } from './bookPaint';
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
) {
  const log: Log = { texts: [], calls: [] };
  const create: CanvasFactory = (width, height) =>
    ({ width, height, getContext: () => fakeContext(log) }) as unknown as HTMLCanvasElement;
  const canvas = paintPage(create, book, side);
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
