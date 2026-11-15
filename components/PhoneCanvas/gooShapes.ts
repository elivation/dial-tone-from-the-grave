import * as THREE from 'three';
import { fbm, seededRandom } from './noise';

/**
 * Shapes for the slime. Each is built in its own flat frame: x runs to 3 o'clock on the dial,
 * z to 6 o'clock, and y is straight out of the dial face. Every geometry also carries a
 * `thickness` attribute, 0 for a thin film and 1 for the thick middle, which colours it.
 */

const TAU = Math.PI * 2;

/**
 * Noise round a closed outline, in [0, 1]. Sampled on a circle in noise space, so it joins up
 * where the outline starts and ends.
 */
export function edgeNoise(theta: number, seed: number, roughness = 2.2): number {
  return fbm(
    Math.cos(theta) * roughness + seed * 3.17,
    Math.sin(theta) * roughness + seed * 1.91,
    4,
  );
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

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
  /** How many small bubbles sit on its surface, 0 to 3. */
  bubbles?: number;
};

export type PoolSurface = {
  /** Distance from the middle to the edge of the pool, at `theta` radians round it. */
  outline: (theta: number) => number;
  /** Height of the surface above the floor at a point inside the pool, in the pool's own frame. */
  heightAt: (x: number, z: number) => number;
};

/** The lumps never stand taller than this share of the meniscus, so the wall stays the highest point. */
const LUMP_SHARE = 0.4;
const LUMPS = 4;

/**
 * The top of the liquid in a hole: low and lumpy in the middle, climbing where it meets the wall.
 * Every point is at or below `top`.
 */
export function poolSurface({ radius, top, seed }: PoolShape): PoolSurface {
  const random = seededRandom(seed);
  const phase = Array.from({ length: 5 }, () => random() * TAU);
  const at = (i: number) => phase[i] ?? 0;
  const outline = (theta: number) =>
    radius *
    // Liquid fills out to the wall of the hole, so the outline only wobbles a little inside it.
    (0.95 +
      0.015 * Math.sin(2 * theta + at(0)) +
      0.008 * Math.sin(3 * theta + at(1)) +
      0.005 * Math.sin(5 * theta + at(2)) +
      // Fine noise, so even the edge against the wall is never a clean curve.
      0.02 * edgeNoise(theta, seed));
  const meniscus = Math.min(MENISCUS, top * 0.35);
  const ripple = Math.min(RIPPLE, top * 0.1);
  const level = top - meniscus - ripple;
  const lumpHeight = meniscus * LUMP_SHARE;
  const lumps = Array.from({ length: LUMPS }, () => {
    const t = random() * TAU;
    const r = Math.sqrt(random()) * 0.5 * radius;
    return {
      x: Math.cos(t) * r,
      z: Math.sin(t) * r,
      size: lerp(0.5, 1, random()),
      width: lerp(0.12, 0.22, random()) * radius,
    };
  });
  // Ripple in [0, ripple], so the surface never rises past `top`.
  const unevenness = (x: number, z: number) =>
    ripple *
    (0.5 + 0.25 * Math.sin((7 * x) / radius + at(3)) + 0.25 * Math.sin((5 * z) / radius + at(4)));
  const lumpsAt = (x: number, z: number) => {
    let sum = 0;
    for (const l of lumps)
      sum += l.size * Math.exp(-(((x - l.x) ** 2 + (z - l.z) ** 2) / (l.width * l.width)));
    return lumpHeight * Math.min(1, sum);
  };
  const heightAt = (x: number, z: number) => {
    const theta = Math.atan2(z, x);
    const rho = Math.min(1, Math.hypot(x, z) / outline(theta));
    // Concave at the edge: flat until about half way out, then curving up the wall.
    const climb = meniscus * smooth(0.5, 1, rho) ** 1.5;
    // Lumps settle in the middle and flatten out before the wall.
    const lumped = lumpsAt(x, z) * (1 - smooth(0.5, 0.8, rho));
    return level + climb + unevenness(x, z) + lumped;
  };
  return { outline, heightAt };
}

const BUBBLE_RINGS = 4;
const BUBBLE_SEGMENTS = 12;

/**
 * Liquid standing in a hole, filling it out to the wall. The surface is a wet meniscus: low,
 * lumpy and uneven in the middle, climbing where it meets the wall. A wall runs from the edge of
 * the surface down to the floor, hidden by the hole round it. A few pools carry small bubbles,
 * listed in `userData.bubbles`.
 */
export function buildPool(shape: PoolShape): THREE.BufferGeometry {
  const { top, seed, bubbles = 0 } = shape;
  const { outline, heightAt } = poolSurface(shape);
  const positions: number[] = [0, heightAt(0, 0), 0];
  const thickness: number[] = [1];
  for (let r = 1; r <= POOL_RINGS; r++) {
    const rho = r / POOL_RINGS;
    for (let s = 0; s < POOL_SEGMENTS; s++) {
      const theta = (s / POOL_SEGMENTS) * TAU;
      const reach = rho * outline(theta);
      const x = reach * Math.cos(theta);
      const z = reach * Math.sin(theta);
      positions.push(x, Math.min(top, heightAt(x, z)), z);
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

  // Bubbles: small glossy domes sitting on the surface, never reaching above the top.
  const random = seededRandom(seed + 900);
  const placed: Array<{ x: number; z: number; r: number }> = [];
  for (let tries = 0; placed.length < bubbles && tries < 40; tries++) {
    const t = random() * TAU;
    const reach = Math.sqrt(random()) * 0.55 * outline(t);
    const x = Math.cos(t) * reach;
    const z = Math.sin(t) * reach;
    const base = heightAt(x, z);
    const r = Math.min(lerp(0.00012, 0.0003, random()), (top - base) / 0.75);
    if (r < 0.00009) continue;
    if (placed.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r)) continue;
    placed.push({ x, z, r });
    const start = positions.length / 3;
    positions.push(x, base + r * 0.75 - 0.00001, z);
    thickness.push(0.85);
    for (let ring = 1; ring <= BUBBLE_RINGS; ring++) {
      const phi = (ring / BUBBLE_RINGS) * (Math.PI / 2);
      for (let k = 0; k < BUBBLE_SEGMENTS; k++) {
        const a = (k / BUBBLE_SEGMENTS) * TAU;
        const px = x + Math.cos(a) * Math.sin(phi) * r;
        const pz = z + Math.sin(a) * Math.sin(phi) * r;
        // A cap, sunk a little into the goo it floats in.
        positions.push(px, Math.min(top, base + Math.cos(phi) * r * 0.75 - 0.00001), pz);
        thickness.push(0.85 - 0.3 * (ring / BUBBLE_RINGS));
      }
    }
    for (const i of discIndices(BUBBLE_RINGS, BUBBLE_SEGMENTS)) indices.push(start + i);
  }
  const geometry = finish(new THREE.BufferGeometry(), positions, indices, thickness);
  geometry.userData['bubbles'] = placed;
  return geometry;
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
  /** The thickest it gets, in metres. A dried stain is 0.12 mm; a fresh puddle is thicker. */
  height?: number;
  seed: number;
};

/**
 * Old slime leaked onto the plate: a flat, irregular film, thickest in the middle and thinning to
 * nothing at a ragged edge. A running stain is drawn out downhill into a tail.
 */
export function buildStain({
  size,
  run,
  direction,
  height = STAIN_HEIGHT,
  seed,
}: StainShape): THREE.BufferGeometry {
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
      0.02 * Math.sin(7 * theta + at(3)) +
      0.12 * (edgeNoise(theta, seed) - 0.5));
  const place = (x: number, z: number): [number, number] => {
    const along = x * direction.x + z * direction.z;
    if (along <= 0) return [x, z];
    // Only the downhill half is drawn out, so the tail grows from the blob.
    const stretch = run * STAIN_RUN;
    return [x + direction.x * along * stretch, z + direction.z * along * stretch];
  };
  const positions: number[] = [0, STAIN_LIFT + height, 0];
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
      positions.push(x, STAIN_LIFT + height * film, z);
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

const BLOB_SEGMENTS = 36;
const BLOB_RINGS = 6;

export type BlobShape = {
  /** Rough radius of its footprint before the noise. */
  radius: number;
  /** Rough height at its middle. */
  height: number;
  /** Draws the blob out along x, 1 for none. */
  stretch: number;
  seed: number;
};

/**
 * A glob of slime sitting on a surface: a lumpy, flat-bottomed dome with a noisy outline. Used
 * for globs on the webs, the goo on the finger stop and the like.
 */
export function buildBlob({ radius, height, stretch, seed }: BlobShape): THREE.BufferGeometry {
  const random = seededRandom(seed);
  const lump = { x: (random() - 0.5) * 0.5, z: (random() - 0.5) * 0.5 };
  const outline = (theta: number) => radius * (0.7 + 0.6 * edgeNoise(theta, seed, 1.6));
  const positions: number[] = [];
  const thickness: number[] = [];
  const surface = (x: number, z: number, rho: number) => {
    // Off-centre lump and fine noise, so it is a glob and not a lens.
    const bump =
      0.85 + 0.3 * Math.exp(-3 * ((x / radius - lump.x) ** 2 + (z / radius - lump.z) ** 2));
    const grain = 0.9 + 0.2 * fbm(x / radius + seed, z / radius - seed, 3);
    return Math.min(
      height * 1.2,
      height * Math.pow(Math.max(0, 1 - rho * rho), 0.7) * bump * grain,
    );
  };
  positions.push(0, surface(0, 0, 0), 0);
  thickness.push(1);
  for (let r = 1; r <= BLOB_RINGS; r++) {
    const rho = r / BLOB_RINGS;
    for (let s = 0; s < BLOB_SEGMENTS; s++) {
      const theta = (s / BLOB_SEGMENTS) * TAU;
      const reach = rho * outline(theta);
      const x = reach * Math.cos(theta) * stretch;
      const z = reach * Math.sin(theta);
      positions.push(x, r === BLOB_RINGS ? 0 : surface(x, z, rho), z);
      thickness.push(1 - rho);
    }
  }
  return finish(
    new THREE.BufferGeometry(),
    positions,
    discIndices(BLOB_RINGS, BLOB_SEGMENTS),
    thickness,
  );
}

export type TubeShape = {
  /** Points the tube runs through, in order. */
  path: THREE.Vector3[];
  /** Radius at `s` along it, 0 at the start to 1 at the end. */
  radiusAt: (s: number) => number;
  sides: number;
  seed: number;
};

/** A strand of slime along a path, its radius changing as it goes, with a slightly lumpy skin. */
export function buildTube({ path, radiusAt, sides, seed }: TubeShape): THREE.BufferGeometry {
  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];
  const n = path.length;
  const widest = Math.max(...path.map((_, i) => radiusAt(i / (n - 1))));
  // Parallel transport, so the rings do not twist along the strand.
  let previousTangent = new THREE.Vector3();
  let side = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    const here = path[i] as THREE.Vector3;
    const ahead = path[Math.min(n - 1, i + 1)] as THREE.Vector3;
    const behind = path[Math.max(0, i - 1)] as THREE.Vector3;
    const tangent = ahead.clone().sub(behind).normalize();
    if (i === 0) {
      const helper =
        Math.abs(tangent.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
      side = new THREE.Vector3().crossVectors(tangent, helper).normalize();
    } else {
      const turn = new THREE.Quaternion().setFromUnitVectors(previousTangent, tangent);
      side.applyQuaternion(turn).normalize();
    }
    previousTangent = tangent;
    const up = new THREE.Vector3().crossVectors(side, tangent).normalize();
    const s = i / (n - 1);
    const radius = radiusAt(s);
    for (let k = 0; k <= sides; k++) {
      const phi = (k / sides) * TAU;
      const skin = 1 + 0.15 * (fbm(phi * 0.8 + seed, s * 6 + seed, 3) - 0.5);
      const v = here
        .clone()
        .addScaledVector(side, Math.cos(phi) * radius * skin)
        .addScaledVector(up, Math.sin(phi) * radius * skin);
      positions.push(v.x, v.y, v.z);
      thickness.push(widest > 0 ? radius / widest : 0);
    }
  }
  const at = (i: number, k: number) => i * (sides + 1) + k;
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sides; k++) {
      indices.push(at(i, k), at(i + 1, k), at(i, k + 1));
      indices.push(at(i + 1, k), at(i + 1, k + 1), at(i, k + 1));
    }
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}

/** Points across a ribbon, edge to edge, less one. */
export const RIBBON_ACROSS = 8;

export type RibbonShape = {
  /** Points on the surface the ribbon follows, each with the surface normal there. */
  path: Array<{ point: THREE.Vector3; normal: THREE.Vector3 }>;
  /** Full width and height at `s` along the path, 0 to 1. */
  widthAt: (s: number) => number;
  heightAt: (s: number) => number;
  seed: number;
  /**
   * Moves a point onto the real surface under it, along `normal`. Each point across the ribbon is
   * draped, so it follows the surface where it curves sideways. Null leaves the point as it is.
   */
  drape?: (point: THREE.Vector3, normal: THREE.Vector3) => THREE.Vector3 | null;
};

/** A thick run of slime lying on a surface: rounded across, with a ragged edge that wanders. */
export function buildRibbon({
  path,
  widthAt,
  heightAt,
  seed,
  drape,
}: RibbonShape): THREE.BufferGeometry {
  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];
  const n = path.length;
  const tallest = Math.max(...path.map((_, i) => heightAt(i / (n - 1))));
  for (let i = 0; i < n; i++) {
    const { point, normal } = path[i] as RibbonShape['path'][number];
    const ahead = (path[Math.min(n - 1, i + 1)] as RibbonShape['path'][number]).point;
    const behind = (path[Math.max(0, i - 1)] as RibbonShape['path'][number]).point;
    const tangent = ahead.clone().sub(behind).normalize();
    const side = new THREE.Vector3().crossVectors(normal, tangent).normalize();
    const s = i / (n - 1);
    const left = widthAt(s) * 0.5 * (0.8 + 0.5 * fbm(s * 9 + seed, seed, 3));
    const right = widthAt(s) * 0.5 * (0.8 + 0.5 * fbm(s * 9 - seed, seed + 7, 3));
    for (let k = 0; k <= RIBBON_ACROSS; k++) {
      const u = (k / RIBBON_ACROSS) * 2 - 1;
      const across = u < 0 ? u * left : u * right;
      const h =
        heightAt(s) *
        Math.sqrt(Math.max(0, 1 - u * u)) *
        (0.9 + 0.25 * fbm(s * 14, u * 3 + seed, 2));
      const flat = point.clone().addScaledVector(side, across);
      const base = (drape ? drape(flat, normal) : null) ?? flat;
      const v = base.addScaledVector(normal, h + 0.00002);
      positions.push(v.x, v.y, v.z);
      thickness.push(tallest > 0 ? h / tallest : 0);
    }
  }
  const at = (i: number, k: number) => i * (RIBBON_ACROSS + 1) + k;
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < RIBBON_ACROSS; k++) {
      indices.push(at(i, k), at(i + 1, k), at(i, k + 1));
      indices.push(at(i, k + 1), at(i + 1, k), at(i + 1, k + 1));
    }
  }
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}

const SPECK_SEGMENTS = 10;

export type Speck = {
  point: THREE.Vector3;
  normal: THREE.Vector3;
  radius: number;
  /** The way a splash flew, if it left a tail. In the surface. */
  tail: THREE.Vector3 | null;
};

/** Fine splatter: a tiny lump of slime on each spot, some with a short tail. One geometry for all of them. */
export function buildSpecks({
  spots,
  seed,
}: {
  spots: Speck[];
  seed: number;
}): THREE.BufferGeometry {
  const positions: number[] = [];
  const thickness: number[] = [];
  const indices: number[] = [];
  spots.forEach((spot, index) => {
    const base = positions.length / 3;
    const helper =
      Math.abs(spot.normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const a = spot.tail
      ? spot.tail.clone().addScaledVector(spot.normal, -spot.tail.dot(spot.normal)).normalize()
      : new THREE.Vector3().crossVectors(spot.normal, helper).normalize();
    const b = new THREE.Vector3().crossVectors(spot.normal, a).normalize();
    const top = spot.point.clone().addScaledVector(spot.normal, spot.radius * 0.45);
    positions.push(top.x, top.y, top.z);
    thickness.push(0.7);
    for (let ring = 1; ring <= 2; ring++) {
      const rho = ring / 2;
      for (let k = 0; k < SPECK_SEGMENTS; k++) {
        const theta = (k / SPECK_SEGMENTS) * TAU;
        const wobble = 0.8 + 0.4 * edgeNoise(theta, seed + index, 1.4);
        let along = Math.cos(theta) * spot.radius * wobble * rho;
        // A splash is drawn out on its far side.
        if (spot.tail && along > 0) along *= 2.2;
        const acrossIt = Math.sin(theta) * spot.radius * wobble * rho;
        const lift = ring === 2 ? 0 : spot.radius * 0.3;
        const v = spot.point
          .clone()
          .addScaledVector(a, along)
          .addScaledVector(b, acrossIt)
          .addScaledVector(spot.normal, lift);
        positions.push(v.x, v.y, v.z);
        thickness.push(ring === 2 ? 0 : 0.4);
      }
    }
    const at = (ring: number, k: number) =>
      base + 1 + (ring - 1) * SPECK_SEGMENTS + (k % SPECK_SEGMENTS);
    for (let k = 0; k < SPECK_SEGMENTS; k++) indices.push(base, at(1, k), at(1, k + 1));
    for (let k = 0; k < SPECK_SEGMENTS; k++) {
      indices.push(at(1, k), at(2, k), at(1, k + 1));
      indices.push(at(1, k + 1), at(2, k), at(2, k + 1));
    }
  });
  return finish(new THREE.BufferGeometry(), positions, indices, thickness);
}
