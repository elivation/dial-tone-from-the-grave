export type PageSide = 'left' | 'right';

/**
 * How much of each page, from its outer edge, turns the page when clicked. About 3 cm of the
 * 21 cm page: wide enough for a thumb on a phone, narrow enough to leave the listings alone.
 */
export const FLIP_STRIP = 0.14;

/**
 * Which way a click at `u` on a page turns the book: back from the strip along the left page's
 * outer edge, on from the strip along the right page's, and nowhere from the rest of the paper.
 * `u` is the page's own UV, so the left page's outer edge is at 0 and the right page's is at 1.
 */
export function flipFromStrip(side: PageSide, u: number): -1 | 1 | null {
  if (side === 'left') return u < FLIP_STRIP ? -1 : null;
  return u > 1 - FLIP_STRIP ? 1 : null;
}
