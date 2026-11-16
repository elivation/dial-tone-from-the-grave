// @vitest-environment node
/** [Req 14.1, 14.2] The seed data feels like Johannesburg: suburbs from across the city, and its trades. */
import { describe, it, expect } from 'vitest';
import { BUSINESSES } from './businesses';
import { RESIDENTS } from './residents';
import { REGIONS, SUBURBS, regionOf } from './suburbs';

const everyone = [...BUSINESSES, ...RESIDENTS];

describe('Johannesburg flavour', () => {
  it('[Req 14.1] spreads the listings across at least 12 suburbs', () => {
    expect(new Set(everyone.map((l) => l.suburb)).size).toBeGreaterThanOrEqual(12);
  });

  it('[Req 14.1] reaches the east, the north, the west and Soweto, with several listings in each', () => {
    for (const region of ['east', 'north', 'west', 'soweto'] as const) {
      const here = everyone.filter((l) => regionOf(l.suburb) === region);
      expect(here.length, region).toBeGreaterThanOrEqual(10);
    }
  });

  it('only uses suburbs whose part of the city it knows', () => {
    for (const l of everyone) expect(regionOf(l.suburb), l.suburb).not.toBeNull();
    expect(Object.keys(REGIONS).length).toBeGreaterThanOrEqual(4);
  });

  it('[Req 14.1] puts every listing that names a place in that place', () => {
    // Places a name or description can mention, and the suburb or part of the city they mean.
    const places: Array<[RegExp, (suburb: string) => boolean]> = [
      ...SUBURBS.map((name): [RegExp, (suburb: string) => boolean] => [
        new RegExp(`\\b${name}\\b`),
        (s) => s === name,
      ]),
      [/\bKempton\b/, (s) => s === 'Kempton Park'],
      [/\bOrlando\b/, (s) => s === 'Orlando West'],
      [/\bSoweto\b/, (s) => regionOf(s) === 'soweto'],
      [/\bEast Rand\b/, (s) => regionOf(s) === 'east'],
      [/\bnorthern suburbs\b/, (s) => regionOf(s) === 'north'],
      [/\bin the west\b|\bRiverlea\b/, (s) => regionOf(s) === 'west'],
    ];
    for (const b of BUSINESSES) {
      for (const [pattern, fits] of places) {
        if (pattern.test(`${b.name} ${b.description}`))
          expect(fits(b.suburb), `${b.name} is in ${b.suburb}`).toBe(true);
      }
    }
  });

  it('[Req 14.2] has the trades people in Johannesburg actually need', () => {
    const categories = new Set(BUSINESSES.filter((b) => !b.is_spirit).map((b) => b.category));
    for (const trade of [
      'Geyser repairs',
      'Gate motors',
      'Borehole pumps',
      'Burglar bars',
      'Generators and inverters',
      'Electrician',
      'Plumber',
      'Locksmith',
      'Panel beater',
      'Pharmacy',
    ]) {
      expect(categories.has(trade), trade).toBe(true);
    }
  });

  it('[Req 14.2] gives prices in rand only, written the South African way', () => {
    for (const b of BUSINESSES) {
      const text = `${b.description} ${b.hours}`;
      expect(text, b.name).not.toMatch(/[$£€]|\bUSD\b|\bdollars?\b/i);
      // "R 450" and "R1,200" must be caught, so a space is allowed only between the R and the digits.
      for (const price of text.match(/\bR ?\d[\d,.]*/g) ?? []) {
        expect(price.trim().replace(/[.,]$/, ''), b.name).toMatch(/^R\d+$/);
      }
    }
  });
});
