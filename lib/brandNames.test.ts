import { describe, it, expect } from 'vitest';
import { findBrandNames } from './brandNames';

describe('findBrandNames', () => {
  it('finds real directory, telecom and phone company names, whatever the case', () => {
    expect(findBrandNames('Call TELKOM for a line')).toEqual(['telkom']);
    expect(findBrandNames('Look it up in the Yellow Pages')).toEqual(['yellow pages']);
    expect(findBrandNames('an MTN contract and a Vodacom sim')).toEqual(['mtn', 'vodacom']);
  });

  it('only matches whole words, so ordinary words are left alone', () => {
    expect(findBrandNames('Mountain View panel beaters')).toEqual([]);
    expect(findBrandNames('Raining cats and dogs')).toEqual([]);
  });

  it('allows our own names: The Dead Pages and its white pages', () => {
    expect(findBrandNames('The Dead Pages, white pages section')).toEqual([]);
  });
});
