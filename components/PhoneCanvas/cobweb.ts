import { seededRandom } from './noise';

export type Vec3 = readonly [number, number, number];

/** A fan of strands from one hub out to a ragged rim, in metres. */
export type WebSpec = {
  hub: Vec3;
  rim: readonly Vec3[];
  /** How many cross strands each radial strand carries on its way out. */
  rings: number;
  /** How far the long strands droop at the middle. */
  sag: number;
  seed: number;
};

export const COBWEB = {
  /** Chance that a cross strand has snapped, so the web looks old. */
  brokenChance: 0.22,
  /** Wobble put into every joint so no strand is ruler straight, in metres. */
  jitter: 0.0008,
  /** Strands far from the flame keep this share of their brightness. */
  glintFloor: 0.14,
  /** Distance from the flame at which a strand has lost half of what the flame adds, in metres. */
  glintReach: 0.12,
  /** Largest tilt of the whole web, in radians. A breath of air, not a breeze. */
  maxSway: 0.012,
  /** Largest swing in brightness, as a fraction. */
  maxShimmer: 0.12,
} as const;

function lerp(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/**
 * Line segments for a sheet of web: radial strands from the hub to each rim point, and cross
 * strands joining neighbouring radials at each ring. Some cross strands are left out. Returns
 * x, y, z pairs, six numbers per segment, ready for a LineSegments geometry.
 */
export function webSegments(spec: WebSpec): Float32Array {
  const { hub, rim, rings, sag, seed } = spec;
  const random = seededRandom(seed);
  const wobble = () => (random() - 0.5) * 2 * COBWEB.jitter;

  // radials[i][k] is the point k rings out along strand i, with k = 0 at the hub.
  const radials = rim.map((end) =>
    Array.from({ length: rings + 1 }, (_, k): Vec3 => {
      const t = k / rings;
      const p = lerp(hub, end, t);
      // Strands droop most in the middle and not at all where they are fixed.
      const droop = sag * 4 * t * (1 - t);
      const edge = k === 0 || k === rings ? 0 : 1;
      return [p[0] + wobble() * edge, p[1] - droop + wobble() * edge, p[2] + wobble() * edge];
    }),
  );

  const out: number[] = [];
  const push = (a: Vec3, b: Vec3) => out.push(a[0], a[1], a[2], b[0], b[1], b[2]);

  for (const strand of radials) {
    for (let k = 0; k < rings; k++) push(strand[k] as Vec3, strand[k + 1] as Vec3);
  }
  for (let i = 0; i + 1 < radials.length; i++) {
    for (let k = 1; k <= rings; k++) {
      if (random() < COBWEB.brokenChance) continue;
      push((radials[i] as Vec3[])[k] as Vec3, (radials[i + 1] as Vec3[])[k] as Vec3);
    }
  }
  return new Float32Array(out);
}

/** How brightly a strand catches the flame, 0 to 1. Falls off with the square of the distance. */
export function strandSheen(point: Vec3, flame: Vec3): number {
  const dx = point[0] - flame[0];
  const dy = point[1] - flame[1];
  const dz = point[2] - flame[2];
  const ratio = (dx * dx + dy * dy + dz * dz) / (COBWEB.glintReach * COBWEB.glintReach);
  return COBWEB.glintFloor + (1 - COBWEB.glintFloor) / (1 + ratio);
}

/** Sway and shimmer of the web at time t, in seconds. Dead still and steady with reduced motion. */
export function webMotion(
  t: number,
  reducedMotion: boolean,
): { swayX: number; swayZ: number; shimmer: number } {
  if (reducedMotion) return { swayX: 0, swayZ: 0, shimmer: 1 };
  return {
    swayX: COBWEB.maxSway * Math.sin(t * 0.31),
    swayZ: COBWEB.maxSway * Math.sin(t * 0.23 + 1.3),
    shimmer: 1 + COBWEB.maxShimmer * Math.sin(t * 2.1 + 0.6) * Math.sin(t * 0.7),
  };
}
