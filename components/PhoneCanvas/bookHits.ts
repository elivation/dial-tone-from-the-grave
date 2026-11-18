import { PAGE_H, PAGE_W, cellOf, type BookLayout, type PlacedEntry } from './bookContent';

/**
 * Where one real listing sits on a page, in the page's UV space: u runs left to right and v runs
 * bottom to top, as on the mesh. The range is half open, so two neighbours never both claim a point.
 */
export type PageHit = { id: string; u0: number; u1: number; v0: number; v1: number };
export type BookHits = { left: PageHit[]; right: PageHit[] };

function hitOf(placed: PlacedEntry, mode: BookLayout['mode']): PageHit | null {
  const { id } = placed.entry;
  if (id === null) return null;
  const cell = cellOf(placed, mode);
  return {
    id,
    u0: Math.max(0, cell.x / PAGE_W),
    u1: Math.min(1, (cell.x + cell.w) / PAGE_W),
    v0: Math.max(0, 1 - (cell.y + cell.h) / PAGE_H),
    v1: Math.min(1, 1 - cell.y / PAGE_H),
  };
}

/** The clickable rectangles of a laid out book. Filler entries are left out, so they do nothing. */
export function hitsFor(layout: BookLayout): BookHits {
  const rects = (entries: PlacedEntry[]) =>
    entries.flatMap((placed) => hitOf(placed, layout.mode) ?? []);
  return { left: rects(layout.left.entries), right: rects(layout.right.entries) };
}

/** The listing at a point on a page, or null for the margin, the filler and the advert. */
export function listingAt(hits: readonly PageHit[], u: number, v: number): string | null {
  return hits.find((hit) => u >= hit.u0 && u < hit.u1 && v >= hit.v0 && v < hit.v1)?.id ?? null;
}
