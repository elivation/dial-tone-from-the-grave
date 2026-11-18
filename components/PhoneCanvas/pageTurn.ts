/** How long a page takes to turn, in seconds. */
export const TURN_SECONDS = 0.7;

/** How far the outer edge of the leaf runs ahead of the spine edge at the most, in radians. */
const BEND = 0.8;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Smoothstep: a turn starts and ends gently. */
export function turnEase(progress: number): number {
  const t = clamp01(progress);
  return t * t * (3 - 2 * t);
}

/**
 * The shape of the turning leaf, side on. It is hinged at the spine, where x and y are 0, and its
 * length never changes, so it bends rather than stretches. A forward turn (1) carries the leaf
 * from lying on the right page over to the left, a backward turn (-1) the other way. The outer
 * edge runs ahead of the rest, as when a finger draws a page over, and the page lands flat.
 * Returns the position of each of the `columns + 1` points along the leaf, outwards from the spine.
 */
export function leafProfile(
  direction: 1 | -1,
  progress: number,
  columns: number,
  length: number,
): { x: number[]; y: number[] } {
  const p = clamp01(progress);
  const eased = turnEase(p);
  const swing = Math.PI * (direction === 1 ? eased : 1 - eased);
  const bend = BEND * Math.sin(Math.PI * p);
  const step = length / columns;
  const x = [0];
  const y = [0];
  for (let i = 1; i <= columns; i++) {
    const along = (i - 0.5) / columns;
    // Kept between flat on either page, so the leaf never dips into the page it lands on.
    const angle = Math.min(Math.PI, Math.max(0, swing + direction * bend * along));
    x.push(x[i - 1]! + Math.cos(angle) * step);
    y.push(y[i - 1]! + Math.sin(angle) * step);
  }
  return { x, y };
}
