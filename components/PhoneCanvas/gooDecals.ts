import type { HoleOpening } from './goo';
import { seededRandom } from './noise';

/**
 * Slime painted onto surfaces rather than built as meshes: overflow smears and finger streaks on
 * the wheel's top face, fingerprints on the number ring, and the trails a dragged hole leaves on
 * the plate. Everything here is a plan in dial space. `gooPainter.ts` draws it onto canvases.
 *
 * Dial space is the plane of the dial, centred on its axis, in metres: x towards 12 o'clock and
 * y towards 3 o'clock, the same as `HoleOpening`. Angles are degrees clockwise from 12 o'clock.
 */

export type DialPoint = { x: number; y: number };

/** `wet` is 1 for fresh, glossy goo and 0 for dried crust. `alpha` is how much it covers. */
export type Stroke =
  | {
      kind: 'smear';
      at: DialPoint;
      /** Rough half-size before the noise and the stretch. */
      size: number;
      /** Which way it is drawn out, radians from the x axis towards y. */
      angle: number;
      stretch: number;
      alpha: number;
      wet: number;
      seed: number;
    }
  | { kind: 'streak'; points: DialPoint[]; width: number; alpha: number; wet: number; seed: number }
  | { kind: 'print'; at: DialPoint; size: number; angle: number; alpha: number; seed: number }
  | { kind: 'dab'; at: DialPoint; size: number; alpha: number; wet: number; seed: number };

export type Dab = Extract<Stroke, { kind: 'dab' }>;

/** A square canvas covering the dial out to `extent` metres from its centre. */
export type DecalSpace = { extent: number; size: number };

/** How far past its size the noise may push a painted shape. The painter keeps to this. */
export const STROKE_REACH = 1.3;
/** Prints are ellipses of ridges inside their size, with a little smudge. */
export const PRINT_REACH = 1.15;
/**
 * Nothing is painted closer to the card than this. The wheel's face stands above the card, so
 * from the camera paint less than this far out lands on the card's rim.
 */
const CARD_MARGIN = 0.0025;

const TAU = Math.PI * 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const polar = (r: number, degrees: number): DialPoint => {
  const t = (degrees * Math.PI) / 180;
  return { x: Math.cos(t) * r, y: Math.sin(t) * r };
};
const radiusOf = (p: DialPoint) => Math.hypot(p.x, p.y);

/** Canvas pixel for a point in dial space. Matches the planar uv the meshes are given. */
export function toCanvas(p: DialPoint, { extent, size }: DecalSpace): { x: number; y: number } {
  return { x: ((p.y / extent + 1) / 2) * size, y: (1 - (p.x / extent + 1) / 2) * size };
}

/** Planar uv for a point in dial space, for a canvas covering `extent` metres from the centre. */
export function dialUv(p: DialPoint, extent: number): { u: number; v: number } {
  return { u: (p.y / extent + 1) / 2, v: (p.x / extent + 1) / 2 };
}

/** The nearest and furthest a stroke can reach from the dial's axis, once drawn. */
export function strokeRadii(stroke: Stroke): { inner: number; outer: number } {
  if (stroke.kind === 'streak') {
    const radii = stroke.points.map(radiusOf);
    return { inner: Math.min(...radii) - stroke.width, outer: Math.max(...radii) + stroke.width };
  }
  const reach =
    stroke.kind === 'smear'
      ? stroke.size * stroke.stretch * STROKE_REACH
      : stroke.kind === 'print'
        ? stroke.size * PRINT_REACH
        : stroke.size * STROKE_REACH;
  const r = radiusOf(stroke.at);
  return { inner: r - reach, outer: r + reach };
}

export type FilmPlan = {
  strokes: Stroke[];
  /** Holes whose slime has overflowed onto the wheel face. */
  overflowHoles: number[];
  /** Holes a finger has dragged goo round from. */
  streakHoles: number[];
};

const OVERFLOW = { min: 4, max: 5 };

/**
 * The wheel's top face: overflow smeared out over the rims of 4 or 5 holes, every full hole among
 * them, and streaks dragged clockwise out of the full holes, the way a finger pulls goo round.
 */
export function planWheelFilm({
  openings,
  fullHoles,
  dialRadius,
  cardRadius,
  seed,
}: {
  openings: HoleOpening[];
  fullHoles: number[];
  dialRadius: number;
  cardRadius: number;
  seed: number;
}): FilmPlan {
  const random = seededRandom(seed);
  const fits = (stroke: Stroke) => {
    const { inner, outer } = strokeRadii(stroke);
    return inner > cardRadius + CARD_MARGIN && outer <= dialRadius;
  };
  const strokes: Stroke[] = [];
  const others = openings
    .map((_, i) => i)
    .filter((i) => !fullHoles.includes(i))
    .map((i) => ({ i, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.i);
  const total = OVERFLOW.min + Math.floor(random() * (OVERFLOW.max - OVERFLOW.min + 1));
  const overflowHoles = [...fullHoles, ...others].slice(0, Math.max(total, fullHoles.length));

  for (const hole of overflowHoles) {
    const opening = openings[hole] as HoleOpening;
    const outward = Math.atan2(opening.y, opening.x);
    const pieces = 3 + Math.floor(random() * 2);
    let placed = 0;
    for (let tries = 0; placed < pieces && tries < 80; tries++) {
      // Out over the outer rim and the sides, never towards the card.
      const dir = outward + (random() - 0.5) * Math.PI * 1.0;
      const reach = opening.radius * lerp(1.0, 1.35, random());
      const size = lerp(0.0015, 0.0028, random()) * (tries > 40 ? 0.65 : 1);
      const stroke: Stroke = {
        kind: 'smear',
        at: { x: opening.x + Math.cos(dir) * reach, y: opening.y + Math.sin(dir) * reach },
        size,
        // Drawn out along the rim, give or take.
        angle: dir + Math.PI / 2 + (random() - 0.5) * 1.2,
        stretch: lerp(1.3, 2.4, random()),
        alpha: lerp(0.75, 0.95, random()),
        // Mostly fresh, so it catches the light on the black glass. Some has dried.
        wet: random() < 0.75 ? lerp(0.75, 1, random()) : lerp(0.1, 0.35, random()),
        seed: Math.floor(random() * 1e6),
      };
      if (!fits(stroke)) continue;
      strokes.push(stroke);
      placed++;
    }
  }

  const streakHoles: number[] = [];
  fullHoles.forEach((hole, n) => {
    const opening = openings[hole] as HoleOpening;
    const r0 = Math.hypot(opening.x, opening.y);
    const a0 = ((((Math.atan2(opening.y, opening.x) * 180) / Math.PI) % 360) + 360) % 360;
    // Most fingers drag round the outside of the ring, one round the inside near the card.
    const inside = n === 1;
    const band = inside ? cardRadius + CARD_MARGIN + 0.0011 : dialRadius * 0.95;
    const start = r0 + (inside ? -1 : 1) * opening.radius * 0.85;
    const span = lerp(20, 36, random());
    const ridges = 5 + Math.floor(random() * 3);
    for (let k = 0; k < ridges; k++) {
      const offset = (k - (ridges - 1) / 2) * 0.00034 * (inside ? -1 : 1);
      const points: DialPoint[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        const r = lerp(start, band, smooth(0, 0.4, t)) + offset * smooth(0, 0.3, t);
        points.push(polar(r, a0 + t * span * lerp(0.85, 1, (k % 2) * 0.5 + 0.5)));
      }
      const stroke: Stroke = {
        kind: 'streak',
        points,
        width: lerp(0.00018, 0.00042, random()),
        alpha: lerp(0.2, 0.35, random()),
        wet: lerp(0.3, 0.8, random()),
        seed: Math.floor(random() * 1e6),
      };
      if (fits(stroke)) strokes.push(stroke);
    }
    streakHoles.push(hole);
  });
  return { strokes, overflowHoles, streakHoles };
}

/** Smeared fingerprints round the number ring and the edge of the plate, outside the wheel. */
export function planPlatePrints({
  dialRadius,
  plateRadius,
  seed,
}: {
  dialRadius: number;
  plateRadius: number;
  cardRadius: number;
  seed: number;
}): Stroke[] {
  const random = seededRandom(seed);
  const count = 4 + Math.floor(random() * 3);
  const first = random() * 360;
  const prints: Stroke[] = [];
  for (let i = 0; i < count; i++) {
    const size = lerp(0.0032, 0.0042, random());
    const reach = size * PRINT_REACH;
    const inner = dialRadius * 1.01 + reach;
    const outer = plateRadius - reach;
    if (outer <= inner) continue;
    const degrees = first + (i * 360) / count + (random() - 0.5) * 30;
    prints.push({
      kind: 'print',
      at: polar(lerp(inner, outer, random()), degrees),
      size,
      angle: random() * TAU,
      alpha: lerp(0.5, 0.7, random()),
      seed: Math.floor(random() * 1e6),
    });
  }
  return prints;
}

const BIN_DEGREES = 3;
const DAB_ALPHA = 0.09;
const MAX_DOSES = 2;
/** The most dabs that can land on one spot in one pass: a dab is about five bins across. */
const OVERLAP = 6;
const MAX_BEHIND = 4;
const MAX_STOP = 5;

/**
 * Keeps count of the goo a dragged finger has left, so trails build up over a session but stop
 * before they hide the plate. The plate is divided into bins round the hole ring. Every hole runs
 * along the same ring, so the cap is on the plate, not on the hole.
 */
export class TrailLedger {
  /** Each bin takes at most this many dabs. */
  static readonly maxDoses = MAX_DOSES;
  /** The most the trails can ever cover a point on the plate, 0 to 1. */
  static readonly maxCoverage = 1 - Math.pow(1 - DAB_ALPHA, MAX_DOSES * OVERLAP);

  private readonly openings: HoleOpening[];
  private readonly doses = new Map<number, number>();
  private readonly behindCount = new Map<number, number>();
  private stopCount = 0;
  private readonly random: () => number;

  constructor({ openings }: { openings: HoleOpening[] }) {
    this.openings = openings;
    this.random = seededRandom(97);
  }

  /** Dabs for the stretch of plate a hole has swept, turning from `fromTurn` to `toTurn` degrees. */
  sweep(hole: number, fromTurn: number, toTurn: number): Dab[] {
    const opening = this.openings[hole];
    if (!opening) return [];
    const r0 = Math.hypot(opening.x, opening.y);
    const a0 = (Math.atan2(opening.y, opening.x) * 180) / Math.PI;
    const lo = a0 + Math.min(fromTurn, toTurn);
    const hi = a0 + Math.max(fromTurn, toTurn);
    const dabs: Dab[] = [];
    for (let bin = Math.ceil(lo / BIN_DEGREES - 0.5); (bin + 0.5) * BIN_DEGREES < hi; bin++) {
      const centre = (bin + 0.5) * BIN_DEGREES;
      if (centre < lo) continue;
      const key = ((bin % (360 / BIN_DEGREES)) + 360 / BIN_DEGREES) % (360 / BIN_DEGREES);
      const used = this.doses.get(key) ?? 0;
      if (used >= MAX_DOSES) continue;
      this.doses.set(key, used + 1);
      dabs.push({
        kind: 'dab',
        at: polar(
          r0 + (this.random() - 0.5) * opening.radius * 0.5,
          centre + (this.random() - 0.5) * BIN_DEGREES,
        ),
        size: opening.radius * lerp(0.32, 0.46, this.random()),
        alpha: DAB_ALPHA,
        wet: 1,
        seed: Math.floor(this.random() * 1e6),
      });
    }
    return dabs;
  }

  /**
   * Goo wiped onto the plate by the finger stop, where the finger slides off it at the end of a
   * full turn. `stop` is where fingers hit the stop, in dial space. Capped, like everything else.
   */
  atStop(stop: DialPoint): Dab[] {
    if (this.stopCount >= MAX_STOP) return [];
    this.stopCount++;
    const r = Math.hypot(stop.x, stop.y);
    const a = (Math.atan2(stop.y, stop.x) * 180) / Math.PI;
    return Array.from({ length: 2 }, () => ({
      kind: 'dab' as const,
      // Just round from the stop, on the side the finger arrives from.
      at: polar(r + (this.random() - 0.5) * 0.0025, a - lerp(1, 4, this.random())),
      size: lerp(0.0007, 0.0012, this.random()),
      alpha: lerp(0.35, 0.5, this.random()),
      wet: 0.85,
      seed: Math.floor(this.random() * 1e6),
    }));
  }

  /** A smear on the wheel face just behind the finger, anticlockwise of the hole. Capped per hole. */
  behind(hole: number): Dab[] {
    const opening = this.openings[hole];
    const used = this.behindCount.get(hole) ?? 0;
    if (!opening || used >= MAX_BEHIND) return [];
    this.behindCount.set(hole, used + 1);
    const r0 = Math.hypot(opening.x, opening.y);
    const a0 = (Math.atan2(opening.y, opening.x) * 180) / Math.PI;
    const back = ((opening.radius * 1.3) / r0) * (180 / Math.PI) + this.random() * 4;
    return [
      {
        kind: 'dab',
        at: polar(r0 + (this.random() - 0.5) * opening.radius * 0.6, a0 - back),
        size: opening.radius * lerp(0.34, 0.46, this.random()),
        alpha: lerp(0.5, 0.65, this.random()),
        wet: 0.9,
        seed: Math.floor(this.random() * 1e6),
      },
    ];
  }
}
