import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';

const business = (
  n: number,
  name: string,
  suburb: string,
  overrides: Partial<BusinessResult> = {},
): BusinessResult => ({
  id: `fixture-b${n}`,
  name,
  category: 'plumber',
  suburb,
  address: `${10 + n} Fixture Road`,
  phone: `011 000 ${1100 + n}`,
  dial_number: `6${1100 + n}`,
  hours: '24 hours',
  description: 'Invented for render checks',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
  ...overrides,
});

/** Invented search results for the dev preview, so the book can be rendered without a call. */
export const FIXTURE_BUSINESSES: BusinessResult[] = [
  business(1, 'Edenvale Geyser Rescue', 'Edenvale', { is_advert: true }),
  business(2, 'Hollow Drain and Pipe', 'Bedfordview'),
  business(3, 'Midnight Plumbing', 'Germiston'),
  business(4, 'Kgomo Leak Detection', 'Primrose'),
];

/** A second search for the dev preview, so the book has a page to flip to. */
export const FIXTURE_BUSINESSES_2: BusinessResult[] = [
  business(11, 'Boksburg Gate Motors', 'Boksburg'),
  business(12, 'Lantern Electrical', 'Kempton Park'),
  business(13, 'Northcliff Borehole Pumps', 'Northcliff', { is_advert: true }),
].map((b, n) => ({ ...b, id: `fixture-c${n + 1}` }));

export const FIXTURE_RESIDENTS: ResidentResult[] = [1, 2, 3].map((n) => ({
  id: `fixture-r${n}`,
  surname: ['Dlamini', 'Naidoo', 'Botha'][n - 1] as string,
  initials: ['T', 'S', 'J'][n - 1] as string,
  suburb: 'Soweto',
  address: `${n} Fixture Street`,
  phone: `011 000 ${2200 + n}`,
  dial_number: `7${2200 + n}`,
  score: 1,
}));
