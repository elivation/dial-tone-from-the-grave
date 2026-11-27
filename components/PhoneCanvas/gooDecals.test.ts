import { describe, it, expect } from 'vitest';
import { DIGITS, HOLE_ANGLES } from '@/lib/dial';
import type { HoleOpening } from './goo';
import {
  TrailLedger,
  planPlatePrints,
  planWheelFilm,
  strokeRadii,
  toCanvas,
  type DialPoint,
  type Stroke,
} from './gooDecals';

const R = 0.029;
const CARD = 0.0143;
const HOLE_RING = 0.022;
const OPEN = 0.00455;
const openings: HoleOpening[] = DIGITS.map((d) => {
  const degrees = HOLE_ANGLES[d];
  const t = (degrees * Math.PI) / 180;
  return { degrees, x: Math.cos(t) * HOLE_RING, y: Math.sin(t) * HOLE_RING, radius: OPEN };
});
const full = [0, 4, 7];
const film = planWheelFilm({ openings, fullHoles: full, dialRadius: R, cardRadius: CARD, seed: 3 });

const angleOf = (p: DialPoint) => ((((Math.atan2(p.y, p.x) * 180) / Math.PI) % 360) + 360) % 360;
const radiusOf = (p: DialPoint) => Math.hypot(p.x, p.y);
const distance = (a: DialPoint, b: DialPoint) => Math.hypot(a.x - b.x, a.y - b.y);
const of = <K extends Stroke['kind']>(strokes: Stroke[], kind: K) =>
  strokes.filter((s): s is Extract<Stroke, { kind: K }> => s.kind === kind);

describe('planWheelFilm', () => {
  it('[Req 1.1] overflows 4 or 5 holes, every full hole among them', () => {
    expect(film.overflowHoles.length).toBeGreaterThanOrEqual(4);
    expect(film.overflowHoles.length).toBeLessThanOrEqual(5);
    for (const hole of full) expect(film.overflowHoles).toContain(hole);
  });

  it('[Req 1.1] smears each overflow out over its own rim, in more than one irregular piece, never a circle', () => {
    const smears = of(film.strokes, 'smear');
    for (const hole of film.overflowHoles) {
      const opening = openings[hole] as HoleOpening;
      const mine = smears.filter((s) => distance(s.at, opening) < opening.radius * 1.6);
      expect(mine.length, `hole ${hole}`).toBeGreaterThanOrEqual(2);
      for (const s of mine) {
        expect(distance(s.at, opening)).toBeGreaterThan(opening.radius * 0.8);
        expect(s.stretch).toBeGreaterThanOrEqual(1.2);
      }
    }
  });

  it('[Req 1.1] drags thin, see-through streaks clockwise out of the fuller holes', () => {
    const streaks = of(film.strokes, 'streak');
    expect(streaks.length).toBeGreaterThanOrEqual(full.length);
    for (const hole of film.streakHoles) expect(full).toContain(hole);
    for (const streak of streaks) {
      expect(streak.alpha).toBeLessThanOrEqual(0.35);
      expect(streak.width).toBeLessThanOrEqual(0.0006);
      const angles = streak.points.map(angleOf);
      let travelled = 0;
      for (let i = 1; i < angles.length; i++) {
        const step =
          (((((angles[i] as number) - (angles[i - 1] as number)) % 360) + 540) % 360) - 180;
        // Clockwise is increasing angle. Each step goes that way or holds.
        expect(step).toBeGreaterThanOrEqual(-0.01);
        travelled += step;
      }
      expect(travelled).toBeGreaterThan(15);
      const start = streak.points[0] as DialPoint;
      expect(openings.some((o) => distance(start, o) < o.radius * 1.2)).toBe(true);
    }
  });

  it('[Req 1.1] keeps every stroke on the wheel and off the 1023 card', () => {
    for (const stroke of film.strokes) {
      const { inner, outer } = strokeRadii(stroke);
      // Seen from the camera, paint within 2.5 mm of the card lands on its rim.
      expect(inner, stroke.kind).toBeGreaterThan(CARD + 0.0025);
      expect(outer, stroke.kind).toBeLessThanOrEqual(R);
    }
  });

  it('is the same for the same seed', () => {
    const again = planWheelFilm({
      openings,
      fullHoles: full,
      dialRadius: R,
      cardRadius: CARD,
      seed: 3,
    });
    expect(again).toEqual(film);
  });
});

describe('planPlatePrints', () => {
  const prints = planPlatePrints({ dialRadius: R, plateRadius: 0.0457, cardRadius: CARD, seed: 2 });

  it('[Req 1.1] leaves 4 to 6 smeared fingerprints on the number ring and the plate edge', () => {
    expect(prints.length).toBeGreaterThanOrEqual(4);
    expect(prints.length).toBeLessThanOrEqual(6);
    for (const p of prints) {
      expect(p.kind).toBe('print');
      const { inner, outer } = strokeRadii(p);
      expect(inner).toBeGreaterThan(R * 1.0);
      expect(outer).toBeLessThanOrEqual(0.0457);
      expect(p.alpha).toBeGreaterThanOrEqual(0.45);
      expect(p.alpha).toBeLessThanOrEqual(0.75);
    }
  });
});

describe('TrailLedger', () => {
  const ledger = () => new TrailLedger({ openings });

  it('[Req 1.1] lays goo along the arc the hole sweeps, at the hole ring', () => {
    const trail = ledger().sweep(4, 0, 60);
    expect(trail.length).toBeGreaterThan(5);
    const a0 = (openings[4] as HoleOpening).degrees;
    for (const dab of trail) {
      expect(dab.kind).toBe('dab');
      const turned = (angleOf(dab.at) - a0 + 360) % 360;
      expect(turned).toBeGreaterThan(-1);
      expect(turned).toBeLessThan(61);
      expect(Math.abs(radiusOf(dab.at) - HOLE_RING)).toBeLessThan(OPEN * 0.6);
      expect(strokeRadii(dab).inner).toBeGreaterThan(CARD + 0.001);
    }
  });

  it('[Req 1.1] builds up over many dials, then stops, so the plate is never covered', () => {
    const l = ledger();
    let total = 0;
    for (let i = 0; i < 100; i++) total += l.sweep(4, 0, 60).length;
    const once = ledger().sweep(4, 0, 60).length;
    expect(total).toBeGreaterThan(once);
    expect(total).toBeLessThanOrEqual(once * TrailLedger.maxDoses);
    expect(l.sweep(4, 0, 60)).toEqual([]);
    expect(TrailLedger.maxCoverage).toBeLessThanOrEqual(0.7);
  });

  it('paints only the new part of the arc as the finger moves on', () => {
    const l = ledger();
    const first = l.sweep(2, 0, 30).length;
    const next = l.sweep(2, 30, 31);
    expect(next.length).toBeLessThan(first / 5);
  });

  it('[Req 1.1] smears the wheel face just behind the finger, a little each time, capped', () => {
    const l = ledger();
    const opening = openings[6] as HoleOpening;
    const smear = l.behind(6);
    expect(smear.length).toBeGreaterThan(0);
    for (const s of smear) {
      // Behind the finger means anticlockwise of the hole, just past its rim.
      const back = (((opening.degrees - angleOf(s.at)) % 360) + 360) % 360;
      expect(back).toBeGreaterThan(0);
      expect(back).toBeLessThan(25);
      expect(distance(s.at, opening)).toBeGreaterThan(opening.radius);
      // Clearly visible: fresh goo the finger pulls over the rim each time.
      expect(s.alpha).toBeGreaterThanOrEqual(0.45);
      expect(s.size).toBeGreaterThan(opening.radius * 0.3);
    }
    for (let i = 0; i < 50; i++) l.behind(6);
    expect(l.behind(6)).toEqual([]);
  });
});

describe('TrailLedger at the finger stop', () => {
  it('[Req 1.1] leaves goo on the plate by the finger stop each time a finger reaches it, capped', () => {
    const l = new TrailLedger({ openings });
    const stop = {
      x: Math.cos((142 * Math.PI) / 180) * 0.031,
      y: Math.sin((142 * Math.PI) / 180) * 0.031,
    };
    const first = l.atStop(stop);
    expect(first.length).toBeGreaterThan(0);
    for (const dab of first) {
      expect(distance(dab.at, stop)).toBeLessThan(0.004);
      expect(dab.alpha).toBeGreaterThanOrEqual(0.3);
    }
    for (let i = 0; i < 20; i++) l.atStop(stop);
    expect(l.atStop(stop)).toEqual([]);
  });
});

describe('toCanvas', () => {
  const space = { extent: 0.03, size: 1024 };
  it('puts the dial centre in the middle, 12 o clock at the top and 3 o clock on the right', () => {
    expect(toCanvas({ x: 0, y: 0 }, space)).toEqual({ x: 512, y: 512 });
    expect(toCanvas({ x: 0.03, y: 0 }, space)).toEqual({ x: 512, y: 0 });
    expect(toCanvas({ x: 0, y: 0.03 }, space)).toEqual({ x: 1024, y: 512 });
  });
});
