import * as THREE from 'three';
import { seededRandom } from './noise';

/**
 * Shapes for the slime. Each is built in its own flat frame: x runs to 3 o'clock on the dial,
 * z to 6 o'clock, and y is straight out of the dial face. Every geometry also carries a
 * `thickness` attribute, 0 for a thin film and 1 for the thick middle, which colours it.
 */

const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function finish(
  geometry: THREE.BufferGeometry,
  positions: number[],
  indices: number[],
  thickness: number[],
) {
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('thickness', new THREE.Float32BufferAttribute(thickness, 1));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const POOL_SEGMENTS = 40;
const POOL_RINGS = 8;
const SHOULDER_STEPS = 4;
/** The most the top edge is rounded over, in metres, both sideways and downwards. */
const SHOULDER = 0.0009;

export type PoolShape = {
  /** Widest the pool may be. The hole's own radius. */
  radius: number;
  /** How high the slime stands at the edge of its top surface, above the floor of the hole. */
  fillHeight: number;
  /** How far the middle of the surface rises above that edge. */
  dome: number;
  seed: number;
};

/**
 * Slime standing in a hole. An uneven outline, a wall down to the floor, a rounded shoulder so
 * there is no sharp edge to catch the eye, and a top that is slightly domed, a little off-centre,
 * and thinner towards the edge.
 */
export function buildPool({ radius, fillHeight, dome, seed }: PoolShape): THREE.BufferGeometry {
  const random = seededRandom(seed);
  const phase = [random() * TAU, random() * TAU, random() * TAU];
  const lump = { x: (random() - 0.5) * 0.6, z: (random() - 0.5) * 0.6 };
  const outline = (theta: number) =>
    radius *
    (0.78 +
      0.1 * Math.sin(2 * theta + (phase[0] ?? 0)) +
      0.06 * Math.sin(3 * theta + (phase[1] ?? 0)) +
      0.04 * Math.sin(5 * theta + (phase[2] ?? 0)));

  const rise = Math.min(SHOULDER, fillHeight * 0.4);
  const inset = Math.min(SHOULDER, radius * 0.25);
  const wallTop = fillHeight - rise;

  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];

  // Top surface. Vertex 0 is the middle, then rings of POOL_SEGMENTS going out to where the shoulder starts.
  const middleHeight =
    fillHeight + dome * (0.8 + 0.4 * Math.exp(-3 * (lump.x * lump.x + lump.z * lump.z)));
  positions.push(0, middleHeight, 0);
  thickness.push(1);
  for (let r = 1; r <= POOL_RINGS; r++) {
    const rho = r / POOL_RINGS;
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      const theta = (s / POOL_SEGMENTS) * TAU;
      const reach = rho * (outline(theta) - inset);
      const x = reach * Math.cos(theta);
      const z = reach * Math.sin(theta);
      const bump =
        0.8 + 0.4 * Math.exp(-3 * ((x / radius - lump.x) ** 2 + (z / radius - lump.z) ** 2));
      positions.push(x, fillHeight + dome * Math.pow(1 - rho * rho, 0.6) * bump, z);
      thickness.push(1 - Math.pow(rho, 1.6));
    }
  }
  const top = (r: number, s: number) => 1 + (r - 1) * POOL_SEGMENTS + (s % POOL_SEGMENTS);
  for (let s = 0; s < POOL_SEGMENTS; s++) indices.push(0, top(1, s + 1), top(1, s));
  for (let r = 1; r < POOL_RINGS; r++) {
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      indices.push(top(r, s), top(r, s + 1), top(r + 1, s));
      indices.push(top(r, s + 1), top(r + 1, s + 1), top(r + 1, s));
    }
  }

  // Shoulder, curving down and out from the top surface to the wall, then the wall down to the floor.
  const rings: number[] = [1 + (POOL_RINGS - 1) * POOL_SEGMENTS];
  const addRing = (height: number, pullIn: number) => {
    rings.push(positions.length / 3);
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      const theta = (s / POOL_SEGMENTS) * TAU;
      const reach = outline(theta) - pullIn;
      positions.push(reach * Math.cos(theta), height, reach * Math.sin(theta));
      thickness.push(0);
    }
  };
  for (let j = 1; j <= SHOULDER_STEPS; j++) {
    const phi = (Math.PI / 2) * (1 - j / SHOULDER_STEPS);
    addRing(wallTop + rise * Math.sin(phi), inset * (1 - Math.cos(phi)));
  }
  addRing(0, 0);
  for (let k = 0; k < rings.length - 1; k++) {
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      const upper = rings[k] as number;
      const lower = rings[k + 1] as number;
      const here = s;
      const next = (s + 1) % POOL_SEGMENTS;
      indices.push(upper + here, upper + next, lower + here);
      indices.push(upper + next, lower + next, lower + here);
    }
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}

const SMEAR_RINGS = 10;
const SMEAR_SEGMENTS = 24;
/** Keeps a smear a hair above the glass it lies on, so the two never flicker against each other. */
const SMEAR_LIFT = 0.00008;

export type SmearShape = {
  /** Radius of the hole. */
  radius: number;
  /** Which way round the hole's rim the smear is centred, in radians in the x-z plane. */
  centreAngle: number;
  /** How much of the rim it covers, in radians. */
  arc: number;
  /** How high it bulges over the lip. */
  height: number;
  /** How far below the rim its inner edge sits, so it runs down into the slime in the hole. */
  innerDrop: number;
  seed: number;
};

/** Slime smeared over part of the rim of a hole: it climbs the lip, bulges, then thins out on the glass. */
export function buildSmear({
  radius,
  centreAngle,
  arc,
  height,
  innerDrop,
  seed,
}: SmearShape): THREE.BufferGeometry {
  const random = seededRandom(seed);
  const phase = random() * TAU;
  const inner = radius * 0.7;

  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];
  for (let j = 0; j <= SMEAR_SEGMENTS; j++) {
    const t = j / SMEAR_SEGMENTS;
    const theta = centreAngle - arc / 2 + t * arc;
    // The smear tapers away at both ends of its arc.
    const w = Math.pow(Math.sin(Math.PI * t), 0.6);
    const reach = radius * (1.1 + 0.2 * (0.5 + 0.5 * Math.sin(5 * theta + phase)));
    const outer = inner + (reach - inner) * w;
    const rim = Math.min(1, Math.max(0, (radius - inner) / (outer - inner || 1)));
    for (let i = 0; i <= SMEAR_RINGS; i++) {
      const u = i / SMEAR_RINGS;
      const rho = inner + (outer - inner) * u;
      const y =
        u <= rim
          ? -innerDrop * w + (height * w + innerDrop * w) * smooth(0, 1, rim === 0 ? 1 : u / rim)
          : height * w * (1 - smooth(0, 1, (u - rim) / (1 - rim || 1)));
      positions.push(rho * Math.cos(theta), y + SMEAR_LIFT, rho * Math.sin(theta));
      thickness.push(
        Math.min(1, Math.max(0, 0.15 + 0.5 * ((y + innerDrop) / (height + innerDrop)))),
      );
    }
  }
  const at = (i: number, j: number) => j * (SMEAR_RINGS + 1) + i;
  for (let j = 0; j < SMEAR_SEGMENTS; j++) {
    for (let i = 0; i < SMEAR_RINGS; i++) {
      indices.push(at(i, j), at(i, j + 1), at(i + 1, j));
      indices.push(at(i, j + 1), at(i + 1, j + 1), at(i + 1, j));
    }
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}

const DRIP_RINGS = 28;
const DRIP_SIDES = 14;

/**
 * Half width and height of a drip at `s` along it, as fractions of the hole's radius.
 * Thick where it leaves the rim, narrowing to a neck, then swelling into a fat bead that
 * closes round. Always low, so it lies on the surface.
 */
export function dripProfile(s: number): { width: number; height: number } {
  const taper = 0.4 + (0.22 - 0.4) * smooth(0, 0.55, s);
  const bead = 0.26 * Math.exp(-(((s - 0.84) / 0.1) ** 2));
  // Closes round over the last tenth. Written in terms of the distance left to the end, so it is exactly 0 at s = 1.
  const left = Math.min(1, (1 - s) * 10);
  const close = s < 0.9 ? 1 : Math.sqrt(left * (2 - left));
  const width = (taper + bead) * close;
  return { width, height: width * 0.5 };
}

export type DripShape = {
  /** Radius of the hole it drips from. */
  radius: number;
  /** How far the drip runs, from where it starts at the rim to the end of the bead. */
  length: number;
  /** Which way it runs, a unit vector in the x-z plane. */
  direction: { x: number; z: number };
  /** Raises the drip at `s` along it, 0 to 1, so it can follow a surface that is not flat. */
  lift?: (s: number) => number;
  seed: number;
};

/** A short, thick blob of slime lying on the surface, ending in a fat rounded bead. It starts at the origin. */
export function buildDrip({
  radius,
  length,
  direction,
  lift,
  seed,
}: DripShape): THREE.BufferGeometry {
  const side = { x: -direction.z, z: direction.x };
  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i <= DRIP_RINGS; i++) {
    const s = i / DRIP_RINGS;
    const wobble = 0.1 * radius * s * Math.sin(3.2 * s + seed);
    const cx = direction.x * s * length + side.x * wobble;
    const cz = direction.z * s * length + side.z * wobble;
    const { width, height } = dripProfile(s);
    const raise = lift ? lift(s) : 0;
    for (let k = 0; k <= DRIP_SIDES; k++) {
      const phi = (Math.PI * k) / DRIP_SIDES;
      const across = Math.cos(phi) * width * radius;
      positions.push(
        cx + side.x * across,
        raise + Math.sin(phi) * height * radius,
        cz + side.z * across,
      );
      thickness.push(0.6 * (1 - s));
    }
  }
  const at = (i: number, k: number) => i * (DRIP_SIDES + 1) + k;
  for (let i = 0; i < DRIP_RINGS; i++) {
    for (let k = 0; k < DRIP_SIDES; k++) {
      indices.push(at(i, k), at(i + 1, k), at(i, k + 1));
      indices.push(at(i + 1, k), at(i + 1, k + 1), at(i, k + 1));
    }
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}
