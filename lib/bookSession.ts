import type { BusinessResult, ResidentResult } from '@/lib/listingSearch';

/** The book keeps this many pages. A new search past that drops the oldest page. */
export const BOOK_MAX_PAGES = 12;
export const BOOK_STORAGE_KEY = 'dtftg_book';

export type BookPageSection = 'business' | 'white';

export type BookPage = {
  id: string;
  section: BookPageSection;
  query: string;
  results: BusinessResult[] | ResidentResult[];
  calledIds: string[];
  dogEared: boolean;
};

/** The pages in the order they were searched, which one is open, and the number for the next id. */
export type BookSession = {
  pages: BookPage[];
  current: number;
  nextId: number;
};

export const emptySession: BookSession = { pages: [], current: 0, nextId: 1 };

type Listing = BusinessResult | ResidentResult;

const isResident = (listing: Listing): listing is ResidentResult => 'surname' in listing;

/** Adds the results of one search as a new page and opens it. A search with no results adds nothing. */
export function addPage(
  session: BookSession,
  search: { query: string; results: readonly Listing[] },
): BookSession {
  if (search.results.length === 0) return session;
  const white = search.results.some(isResident);
  const page: BookPage = {
    id: `p${session.nextId}`,
    section: white ? 'white' : 'business',
    query: search.query,
    // A search returns one kind of listing, so a stray one of the other kind is left out.
    results: (white
      ? search.results.filter(isResident)
      : search.results.filter((listing) => !isResident(listing))) as
      | BusinessResult[]
      | ResidentResult[],
    calledIds: [],
    dogEared: false,
  };
  const pages = [...session.pages, page].slice(-BOOK_MAX_PAGES);
  return { pages, current: pages.length - 1, nextId: session.nextId + 1 };
}

/** Circles the listing on every page it is on and dog-ears those pages. */
export function markCalled(session: BookSession, listingId: string): BookSession {
  let changed = false;
  const pages = session.pages.map((page) => {
    const present = page.results.some((listing) => listing.id === listingId);
    if (!present || page.calledIds.includes(listingId)) return page;
    changed = true;
    return { ...page, calledIds: [...page.calledIds, listingId], dogEared: true };
  });
  return changed ? { ...session, pages } : session;
}

/** A call by number, as the dial makes it: every listing in the book with that short number is marked. */
export function markDialled(session: BookSession, digits: string): BookSession {
  const ids = new Set(
    session.pages.flatMap((page) =>
      page.results.filter((listing) => listing.dial_number === digits).map((l) => l.id),
    ),
  );
  return [...ids].reduce(markCalled, session);
}

/** Moves to the page before (-1) or after (1) the open one. It stops at the first and last page. */
export function flipPage(session: BookSession, by: -1 | 1): BookSession {
  const current = Math.min(session.pages.length - 1, Math.max(0, session.current + by));
  return session.pages.length === 0 || current === session.current
    ? session
    : { ...session, current };
}

export const serialiseSession = (session: BookSession): string => JSON.stringify(session);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const allStrings = (value: Record<string, unknown>, keys: readonly string[]) =>
  keys.every((key) => typeof value[key] === 'string');

function isBusiness(value: unknown): value is BusinessResult {
  return (
    isRecord(value) &&
    allStrings(value, ['id', 'name', 'category', 'suburb', 'address', 'phone', 'dial_number']) &&
    allStrings(value, ['hours', 'description']) &&
    typeof value['is_24hr'] === 'boolean' &&
    typeof value['is_advert'] === 'boolean' &&
    typeof value['is_spirit'] === 'boolean' &&
    typeof value['score'] === 'number'
  );
}

function isResidentResult(value: unknown): value is ResidentResult {
  return (
    isRecord(value) &&
    allStrings(value, ['id', 'surname', 'initials', 'suburb', 'address', 'phone', 'dial_number']) &&
    typeof value['score'] === 'number'
  );
}

function readPage(value: unknown): BookPage | null {
  if (!isRecord(value)) return null;
  const { section, results, calledIds } = value;
  if (typeof value['id'] !== 'string' || typeof value['query'] !== 'string') return null;
  if (typeof value['dogEared'] !== 'boolean') return null;
  if (!Array.isArray(results) || !Array.isArray(calledIds)) return null;
  if (!calledIds.every((id) => typeof id === 'string')) return null;
  if (section === 'business' && results.every(isBusiness)) {
    return { ...(value as BookPage), results: results as BusinessResult[] };
  }
  if (section === 'white' && results.every(isResidentResult)) {
    return { ...(value as BookPage), results: results as ResidentResult[] };
  }
  return null;
}

/**
 * Reads what was stored. Anything missing, damaged or of the wrong shape gives an empty book, so
 * a bad entry in storage never stops the page from loading.
 */
export function parseSession(raw: string | null): BookSession {
  if (raw === null) return emptySession;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return emptySession;
  }
  if (!isRecord(data) || !Array.isArray(data['pages'])) return emptySession;
  const pages = data['pages'].map(readPage);
  if (pages.some((page) => page === null)) return emptySession;
  const kept = (pages as BookPage[]).slice(-BOOK_MAX_PAGES);
  const current = typeof data['current'] === 'number' ? Math.trunc(data['current']) : 0;
  const nextId = typeof data['nextId'] === 'number' ? Math.trunc(data['nextId']) : 1;
  return {
    pages: kept,
    current: Math.min(Math.max(0, kept.length - 1), Math.max(0, current)),
    nextId: Math.max(1, nextId),
  };
}
