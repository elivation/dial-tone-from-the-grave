import { formatDialNumber } from '@/lib/exchange';
import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';
import type { Listing } from '@/lib/sse';
import { NO_LISTINGS_MESSAGE, type BookSection } from '@/components/PhoneBookPage/sections';
import { seededRandom } from './noise';

/** Size in pixels of one page texture, portrait. */
export const PAGE_W = 1024;
export const PAGE_H = 1400;

/** The undertaker who advertises on every business page. An invented name. */
export const ADVERT = { x: 70, y: 1020, w: PAGE_W - 140, h: 300 } as const;
export const ADVERT_LINES = [
  'ASHGROVE & DAUGHTERS',
  'Undertakers since 1887',
  'Discreet removals  ·  Night calls welcome',
  'We will come for you.',
] as const;
export const ADVERT_DIAL_NUMBER = formatDialNumber('21000');

export type BookEntry = {
  name: string;
  address: string;
  suburb: string;
  /** The short number as printed, "HO 6-1001". */
  exchange: string;
  /** The 011 number. Filler entries have none. */
  phone: string | null;
  /** A listing from the search, as opposed to the filler that makes the book look full. */
  real: boolean;
  /** Printed in a box, as an advert. */
  boxed: boolean;
  /** Struck through in red pen. */
  crossed: boolean;
  /** How strongly the old print came through, 0 to 1. */
  ink: number;
};

export type PlacedEntry = { entry: BookEntry; x: number; y: number; width: number };
export type PageLayout = { entries: PlacedEntry[]; headLeft: string; headRight: string };
export type BookLayout = {
  mode: BookSection;
  left: PageLayout;
  right: PageLayout;
  /** The undertaker's box, on the business pages only. */
  advert: boolean;
  /** The search found nothing for this section, so the book says so instead of filling the pages. */
  empty: boolean;
};

type Filler = { name: string; address: string; digits: string; person: boolean };

/** Neighbours of The Dead Pages. All invented. */
const BASE: Filler[] = [
  ['ABERNATHY Silas', '13 Hollow Ln', '61313'],
  ['ACHERON Mrs E', 'The Old Rectory', '40066'],
  ['ADDER Thos', '9 Wych Elm Rd', '62140'],
  ['ASHBY Constance', 'Flat 4 Gallows Ct', '27709'],
  ['ASHGROVE Fnrl Parlour', 'Open all night', '21000', false],
  ['BARROW Ezekiel', '7 Cairn St', '65531'],
  ['BELLWEATHER Agnes', 'Mere Cottage', '20909'],
  ['BLACKTHORN Dr M', 'Surgery, Lychgate Rd', '43317', false],
  ['BONE R', '22 Ossuary Wlk', '68812'],
  ['BRAMBLE Hester', '3 Nightjar Ln', '24420'],
  ['CADAVER & SONS Cartage', 'Depot, Coffin Rd', '46600', false],
  ['CAIRN Ivor', '18 Barrow Hill', '60131'],
  ['CANDLEMAS Prudence', 'Vestry Hse', '21201'],
  ['CARRION Wm', '41 Rook St', '67744'],
  ['CINDER Mabel', 'The Kilns', '32028'],
  ['COFFIN Jas', '5 Elm Row', '63390'],
  ['CORVID Lenore', 'Rookery Farm', '26113'],
  ['CROWE Abel', '60 Saltmarsh Rd', '50812'],
  ['CRYPTE Mme', 'Readings by appt', '69999', false],
  ['DANKWORTH Obadiah', '2 Fen End', '23131'],
  ['DIRGE Florence', '11 Knell St', '55050'],
  ['DOLOR Septimus', 'Asylum Lodge', '61919'],
  ['DREAD H', '77 Moor Rd', '20013'],
  ['DUSK Winifred', 'Sundown Villa', '37171'],
  ['EBON Cornelius', '8 Pitch Ln', '64646'],
  ['EMBER Lydia', '14 Ash Wlk', '28282'],
  ['EVERDARK Josiah', 'Lighthouse (disused)', '40000'],
  ['FENWICK Ada', '31 Bog Rd', '62525'],
  ['FETCH Mrs', 'no fixed abode', '26666'],
  ['GALLOWAY Rbt', '1 Scaffold Sq', '41303'],
  ['GHOUL Bros Gravediggers', 'Churchyard', '61300', false],
  ['GRAVES Eliza', '6 Mortlake Rd', '21013'],
  ['GRIM Tobias', 'Reaper Fm', '49191'],
].map(([name, address, digits, person]) => ({
  name: name as string,
  address: address as string,
  digits: digits as string,
  person: person !== false,
}));

const FIRST = [
  'Abel',
  'Agnes',
  'Ezra',
  'Hester',
  'Ivor',
  'Jas',
  'Lenore',
  'Mabel',
  'Obadiah',
  'Prudence',
  'Silas',
  'Thos',
  'Ursula',
  'Wm',
  'Zillah',
  'Mrs E',
  'Dr M',
  'R',
  'H',
  'Septimus',
];
const STREET = [
  'Hollow Ln',
  'Wych Elm Rd',
  'Cairn St',
  'Lychgate Rd',
  'Ossuary Wlk',
  'Rook St',
  'Fen End',
  'Knell St',
  'Moor Rd',
  'Bog Rd',
  'Mortlake Rd',
  'Barrow Hill',
  'Nightjar Ln',
  'Saltmarsh Rd',
  'Pitch Ln',
  'Ash Wlk',
];

const CROSSED_FOR_SURE = /ASHGROVE|CADAVER|EVERDARK/;
const SEED = 13;

function toEntry(f: Filler, rnd: () => number, white: boolean): BookEntry {
  const initial = (f.name.split(' ').pop() ?? '').charAt(0);
  const surname = f.name.split(' ')[0] ?? f.name;
  return {
    name: white ? `${surname} ${initial}` : f.name,
    address: f.address,
    suburb: '',
    exchange: formatDialNumber(f.digits),
    phone: null,
    real: false,
    boxed: false,
    crossed: CROSSED_FOR_SURE.test(f.name) || rnd() < 0.05,
    ink: 0.75 + rnd() * 0.25,
  };
}

/** Each surname gets a few relatives, as a real directory does. Same every time. */
function buildPool(): Filler[] {
  const rnd = seededRandom(SEED);
  const pool: Filler[] = [];
  for (const base of BASE) {
    pool.push(base);
    const surname = base.name.split(' ')[0] ?? '';
    if (!base.person || surname.length <= 3) continue;
    const relatives = 1 + Math.floor(rnd() * 3);
    for (let k = 0; k < relatives; k++) {
      const exchange = 2 + Math.floor(rnd() * 8);
      pool.push({
        name: `${surname} ${FIRST[Math.floor(rnd() * FIRST.length)]}`,
        address: `${1 + Math.floor(rnd() * 98)} ${STREET[Math.floor(rnd() * STREET.length)]}`,
        digits: `${exchange}${String(Math.floor(rnd() * 10000)).padStart(4, '0')}`,
        person: true,
      });
    }
  }
  return pool;
}

const POOL = buildPool();

/**
 * The white pages are denser than the business pages, 46 px an entry against 49 and no adverts, so
 * the pool of neighbours is not enough to fill both. Every family gets more relatives.
 */
function extraRelatives(): Filler[] {
  const rnd = seededRandom(SEED + 2);
  const surnames = new Set(POOL.filter((f) => f.person).map((f) => f.name.split(' ')[0] ?? ''));
  return [...surnames]
    .filter((surname) => surname.length > 3)
    .flatMap((surname) =>
      Array.from({ length: 3 }, () => ({
        name: `${surname} ${FIRST[Math.floor(rnd() * FIRST.length)]}`,
        address: `${1 + Math.floor(rnd() * 98)} ${STREET[Math.floor(rnd() * STREET.length)]}`,
        digits: `${2 + Math.floor(rnd() * 8)}${String(Math.floor(rnd() * 10000)).padStart(4, '0')}`,
        person: true,
      })),
    );
}
const WHITE_POOL = [...POOL.filter((f) => f.person), ...extraRelatives()].sort((a, b) =>
  a.name.localeCompare(b.name),
);
function fillerEntries(white: boolean): BookEntry[] {
  const rnd = seededRandom(SEED + 1);
  return (white ? WHITE_POOL : POOL).map((f) => toEntry(f, rnd, white));
}
const isResident = (listing: Listing): listing is ResidentResult => 'surname' in listing;

function realEntry(listing: Listing): BookEntry {
  const base = {
    exchange: formatDialNumber(listing.dial_number),
    phone: listing.phone,
    real: true,
    crossed: false,
    ink: 1,
  };
  if (isResident(listing)) {
    return {
      ...base,
      name: `${listing.surname.toUpperCase()} ${listing.initials}`,
      address: listing.address,
      suburb: listing.suburb,
      boxed: false,
    };
  }
  const business: BusinessResult = listing;
  return {
    ...base,
    name: business.name,
    address: business.address,
    suburb: business.suburb,
    boxed: business.is_advert,
  };
}

type Area = { x0: number; top: number; maxY: number; cols: number; gap: number };
const RIGHT_EDGE = PAGE_W - 70;

function areaFor(mode: BookSection, side: 'L' | 'R'): Area {
  if (mode === 'white') {
    return {
      x0: side === 'L' ? 70 : 110,
      top: 150,
      maxY: side === 'L' ? PAGE_H - 120 : PAGE_H - 200,
      cols: 3,
      gap: 16,
    };
  }
  return {
    x0: side === 'L' ? 70 : 110,
    top: 150,
    maxY: side === 'L' ? ADVERT.y - 30 : PAGE_H - 200,
    cols: 3,
    gap: 22,
  };
}

function heightOf(entry: BookEntry, mode: BookSection): number {
  if (mode === 'white') return 46;
  if (!entry.real) return 49;
  return entry.boxed ? 92 : 72;
}

function flow(entries: BookEntry[], area: Area, mode: BookSection) {
  const width = (RIGHT_EDGE - area.x0 - (area.cols - 1) * area.gap) / area.cols;
  const placed: PlacedEntry[] = [];
  let col = 0;
  let cursor = area.top;
  let used = 0;
  for (const entry of entries) {
    const h = heightOf(entry, mode);
    if (cursor + h > area.maxY) {
      col += 1;
      cursor = area.top;
    }
    if (col >= area.cols) break;
    placed.push({ entry, x: area.x0 + col * (width + area.gap), y: cursor + 18, width });
    cursor += h;
    used += 1;
  }
  return { placed, rest: entries.slice(used) };
}

const abbreviate = (name: string) =>
  name
    .replace(/[^A-Za-z]/g, '')
    .slice(0, 3)
    .toUpperCase();

function range(entries: PlacedEntry[]): string {
  const first = entries[0]?.entry.name;
  const last = entries.at(-1)?.entry.name;
  return first && last ? `${abbreviate(first)}-${abbreviate(last)}` : '';
}

const PAGE_NUMBER: Record<BookSection, string> = { business: '13', white: '58' };

/** Picks `count` fillers spread evenly through the alphabet. */
const spread = (pool: BookEntry[], count: number) =>
  count <= 0
    ? []
    : Array.from(
        { length: count },
        (_, i) => pool[Math.floor((i * pool.length) / count)] as BookEntry,
      );

const byName = (a: BookEntry, b: BookEntry) => a.name.localeCompare(b.name);

/**
 * Lays out the open book: the search results, sorted in among enough invented neighbours to fill
 * both pages. Pure and seeded, so the same results always give the same book.
 */
export function composeBook(results: readonly Listing[], section: BookSection): BookLayout {
  const white = section === 'white';
  const real = results.filter((listing) => isResident(listing) === white).map(realEntry);
  const pool = fillerEntries(white);
  const left = areaFor(section, 'L');
  const right = areaFor(section, 'R');
  let leftPage: PlacedEntry[] = [];
  let rightPage: PlacedEntry[] = [];
  for (let count = pool.length; count >= 0; count--) {
    const merged = [...real, ...spread(pool, count)].sort(byName);
    const first = flow(merged, left, section);
    const second = flow(first.rest, right, section);
    leftPage = first.placed;
    rightPage = second.placed;
    if (second.rest.length === 0) break;
  }
  return {
    mode: section,
    advert: !white,
    empty: false,
    left: { entries: leftPage, headLeft: range(leftPage), headRight: 'THE DEAD PAGES' },
    right: { entries: rightPage, headLeft: PAGE_NUMBER[section], headRight: range(rightPage) },
  };
}
/** Where the empty page's message is printed, and what it says. */
export const NO_LISTINGS_LINES = [
  'No listings found',
  NO_LISTINGS_MESSAGE.replace('No listings found ', ''),
] as const;
/** The book for a search that found nothing: running heads and the handwritten note, no entries. */
export function composeEmptyBook(section: BookSection): BookLayout {
  return {
    mode: section,
    advert: false,
    empty: true,
    left: { entries: [], headLeft: '', headRight: 'THE DEAD PAGES' },
    right: { entries: [], headLeft: PAGE_NUMBER[section], headRight: '' },
  };
}
/** The book to paint: the listings among their neighbours, or the empty page if this section has none. */
export function bookFor(results: readonly Listing[], section: BookSection): BookLayout {
  const white = section === 'white';
  return results.some((listing) => isResident(listing) === white)
    ? composeBook(results, section)
    : composeEmptyBook(section);
}
