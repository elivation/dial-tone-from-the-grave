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

/** Fan from vertex 0 out through `rings` rings of `segments` vertices, wound to face up. */
function discIndices(rings: number, segments: number): number[] {
  const indices: number[] = [];
  const at = (r: number, s: number) => 1 + (r - 1) * segments + (s % segments);
  for (let s = 0; s < segments; s++) indices.push(0, at(1, s + 1), at(1, s));
  for (let r = 1; r < rings; r++) {
    for (let s = 0; s < segments; s++) {
      indices.push(at(r, s), at(r, s + 1), at(r + 1, s));
      indices.push(at(r, s + 1), at(r + 1, s + 1), at(r + 1, s));
    }
  }
  return indices;
}

const POOL_SEGMENTS = 48;
const POOL_RINGS = 10;
/** How far the surface climbs the wall of the hole, at most. */
const MENISCUS = 0.00035;
/** How uneven the surface is, at most. */
const RIPPLE = 0.00004;

export type PoolShape = {
  /** Widest the pool may be: the radius of the open part of the hole. */
  radius: number;
  /** The highest point of the pool, above the floor of the hole. Nothing goes higher. */
  top: number;
  seed: number;
};

/**
 * Liquid standing in a hole, filling it out to the wall. The surface is a wet meniscus: low and
 * gently uneven in the middle, climbing where it meets the wall. A wall runs from the edge of the
 * surface down to the floor, hidden by the hole round it.
 */
export function buildPool({ radius, top, seed }: PoolShape): THREE.BufferGeometry {
  const random = seededRandom(seed);
  const phase = Array.from({ length: 5 }, () => random() * TAU);
  const at = (i: number) => phase[i] ?? 0;
  const outline = (theta: number) =>
    radius *
    // Liquid fills out to the wall of the hole, so the outline only wobbles a little inside it.
    (0.955 +
      0.015 * Math.sin(2 * theta + at(0)) +
      0.008 * Math.sin(3 * theta + at(1)) +
      0.005 * Math.sin(5 * theta + at(2)));
  const meniscus = Math.min(MENISCUS, top * 0.35);
  const ripple = Math.min(RIPPLE, top * 0.1);
  const level = top - meniscus - ripple;
  // Ripple in [0, ripple], so the surface never rises past `top`.
  const unevenness = (x: number, z: number) =>
    ripple *
    (0.5 + 0.25 * Math.sin((7 * x) / radius + at(3)) + 0.25 * Math.sin((5 * z) / radius + at(4)));

  const positions: number[] = [0, level + unevenness(0, 0), 0];
  const thickness: number[] = [1];
  for (let r = 1; r <= POOL_RINGS; r++) {
    const rho = r / POOL_RINGS;
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      const theta = (s / POOL_SEGMENTS) * TAU;
      const reach = rho * outline(theta);
      const x = reach * Math.cos(theta);
      const z = reach * Math.sin(theta);
      // Concave at the edge: flat until about half way out, then curving up the wall.
      const climb = meniscus * smooth(0.5, 1, rho) ** 1.5;
      positions.push(x, level + climb + unevenness(x, z), z);
      thickness.push(1 - Math.pow(rho, 1.6));
    }
  }
  const indices = discIndices(POOL_RINGS, POOL_SEGMENTS);
  // Wall from the outer ring of the surface straight down to the floor.
  const edge = 1 + (POOL_RINGS - 1) * POOL_SEGMENTS;
  const floor = positions.length / 3;
  for (let s = 0; s < POOL_SEGMENTS; s++) {
    const theta = (s / POOL_SEGMENTS) * TAU;
    const reach = outline(theta);
    positions.push(reach * Math.cos(theta), 0, reach * Math.sin(theta));
    thickness.push(0);
  }
  for (let s = 0; s < POOL_SEGMENTS; s++) {
    const next = (s + 1) % POOL_SEGMENTS;
    indices.push(edge + s, edge + next, floor + s);
    indices.push(edge + next, floor + next, floor + s);
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}

const STAIN_SEGMENTS = 48;
const STAIN_RINGS = 6;
/** The thickest a stain gets, in metres. A dried film. */
const STAIN_HEIGHT = 0.00012;
/** Keeps a stain a hair above the plate it lies on. */
const STAIN_LIFT = 0.00002;
/** How much a running stain's downhill half is drawn out, at run 1. */
const STAIN_RUN = 1.8;

export type StainShape = {
  /** Half its width before the outline is roughened. */
  size: number;
  /** 0 for a round blob, 1 for one that has run a short way downhill. */
  run: number;
  /** Which way is downhill, a unit vector in the x-z plane. */
  direction: { x: number; z: number };
  seed: number;
};

/**
 * Old slime leaked onto the plate: a flat, irregular film, thickest in the middle and thinning to
 * nothing at a ragged edge. A running stain is drawn out downhill into a tail.
 */
export function buildStain({ size, run, direction, seed }: StainShape): THREE.BufferGeometry {
  const random = seededRandom(seed);
  const phase = Array.from({ length: 4 }, () => random() * TAU);
  const at = (i: number) => phase[i] ?? 0;
  const outline = (theta: number) =>
    size *
    (1 +
      // Mostly even waves, so the outline is ragged without leaning one way: only `run` decides that.
      0.2 * Math.sin(2 * theta + at(0)) +
      0.06 * Math.sin(3 * theta + at(1)) +
      0.04 * Math.sin(5 * theta + at(2)) +
      0.02 * Math.sin(7 * theta + at(3)));
  const place = (x: number, z: number): [number, number] => {
    const along = x * direction.x + z * direction.z;
    if (along <= 0) return [x, z];
    // Only the downhill half is drawn out, so the tail grows from the blob.
    const stretch = run * STAIN_RUN;
    return [x + direction.x * along * stretch, z + direction.z * along * stretch];
  };
  const positions: number[] = [0, STAIN_LIFT + STAIN_HEIGHT, 0];
  const thickness: number[] = [0.5];
  for (let r = 1; r <= STAIN_RINGS; r++) {
    const rho = r / STAIN_RINGS;
    for (let s = 0; s < STAIN_SEGMENTS; s++) {
      const theta = (s / STAIN_SEGMENTS) * TAU;
      const [x, z] = place(
        rho * outline(theta) * Math.cos(theta),
        rho * outline(theta) * Math.sin(theta),
      );
      const film = 1 - rho * rho;
      positions.push(x, STAIN_LIFT + STAIN_HEIGHT * film, z);
      thickness.push(r === STAIN_RINGS ? 0 : 0.5 * (1 - Math.pow(rho, 1.5)));
    }
  }
  return finish(
    new THREE.BufferGeometry(),
    positions,
    discIndices(STAIN_RINGS, STAIN_SEGMENTS),
    thickness,
  );
}
