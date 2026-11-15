import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { buildPool, buildStain } from './gooShapes';

const verticesOf = (geometry: THREE.BufferGeometry) => {
  const position = geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i),
  );
};

/** Average of the face normals, weighted by area. Positive y means the surface faces up. */
function upwardness(geometry: THREE.BufferGeometry): number {
  const position = geometry.getAttribute('position');
  const index = geometry.getIndex();
  if (!index) throw new Error('expected an indexed geometry');
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let up = 0;
  for (let i = 0; i < index.count; i += 3) {
    a.fromBufferAttribute(position, index.getX(i));
    b.fromBufferAttribute(position, index.getX(i + 1));
    c.fromBufferAttribute(position, index.getX(i + 2));
    up += b.clone().sub(a).cross(c.clone().sub(a)).y;
  }
  return up;
}

const thicknessOf = (geometry: THREE.BufferGeometry) => {
  const t = geometry.getAttribute('thickness');
  return Array.from({ length: t.count }, (_, i) => t.getX(i));
};

describe('buildPool', () => {
  const radius = 0.004;
  const top = 0.003;
  const pool = buildPool({ radius, top, seed: 7 });
  const vertices = verticesOf(pool);
  const floorRing = vertices.filter((v) => Math.abs(v.y) < 1e-9);
  const surface = vertices.filter((v) => v.y > 1e-9);

  it('fills the hole out to its wall with a slightly uneven edge, and never wider than the hole', () => {
    const radii = floorRing.map((v) => Math.hypot(v.x, v.z));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    expect(mean).toBeGreaterThan(radius * 0.88);
    expect((Math.max(...radii) - Math.min(...radii)) / mean).toBeGreaterThan(0.04);
    for (const v of vertices) expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(radius);
  });

  it('[Req 1.1] never rises above the top asked for, and reaches it', () => {
    const highest = Math.max(...vertices.map((v) => v.y));
    expect(highest).toBeLessThanOrEqual(top);
    expect(highest).toBeGreaterThan(top * 0.97);
  });

  it('has a wet meniscus: the surface climbs where it meets the wall, so the middle is lower', () => {
    const middle = vertices[0] as THREE.Vector3;
    const edge = surface.filter((v) => Math.hypot(v.x, v.z) > radius * 0.85);
    const halfway = surface.filter((v) => {
      const r = Math.hypot(v.x, v.z);
      return r > radius * 0.3 && r < radius * 0.45;
    });
    const mean = (vs: THREE.Vector3[]) => vs.reduce((a, v) => a + v.y, 0) / vs.length;
    expect(mean(edge)).toBeGreaterThan(mean(halfway) + 0.0001);
    expect(mean(halfway)).toBeGreaterThan(middle.y - 0.0001);
  });

  it('has a gentle, uneven surface, not a flat disc', () => {
    const inner = surface.filter((v) => Math.hypot(v.x, v.z) < radius * 0.5);
    const heights = inner.map((v) => v.y);
    const spread = Math.max(...heights) - Math.min(...heights);
    expect(spread).toBeGreaterThan(0.00001);
    expect(spread).toBeLessThan(0.0002);
  });

  it('stands on the floor of the hole with a wall all round', () => {
    expect(floorRing.length).toBeGreaterThan(20);
  });

  it('can be a thin film on the floor of the hole', () => {
    const film = verticesOf(buildPool({ radius, top: 0.0002, seed: 3 }));
    expect(Math.max(...film.map((v) => v.y))).toBeLessThanOrEqual(0.0002);
    expect(Math.min(...film.map((v) => v.y))).toBeGreaterThanOrEqual(0);
  });

  it('looks different for a different seed and the same for the same seed', () => {
    const again = verticesOf(buildPool({ radius, top, seed: 7 }));
    const other = verticesOf(buildPool({ radius, top, seed: 8 }));
    expect(again.every((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) < 1e-12)).toBe(true);
    expect(other.some((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) > 1e-5)).toBe(true);
  });

  it('faces up', () => {
    expect(upwardness(pool)).toBeGreaterThan(0);
  });
});

describe('buildStain', () => {
  const size = 0.0018;
  const direction = { x: 0.6, z: 0.8 };
  const along = (v: THREE.Vector3) => v.x * direction.x + v.z * direction.z;

  it('[Req 1.1] is flat: under 0.3 mm thick, and never below the surface it lies on', () => {
    const vertices = verticesOf(buildStain({ size, run: 1, direction, seed: 2 }));
    expect(Math.max(...vertices.map((v) => v.y))).toBeLessThan(0.0003);
    expect(Math.min(...vertices.map((v) => v.y))).toBeGreaterThanOrEqual(0);
  });

  it('has an irregular outline', () => {
    const vertices = verticesOf(buildStain({ size, run: 0, direction, seed: 2 }));
    const radii = vertices.map((v) => Math.hypot(v.x, v.z));
    const outer = Math.max(...radii);
    const rim = vertices
      .filter((_, i) => i > vertices.length - 49)
      .map((v) => Math.hypot(v.x, v.z));
    expect((Math.max(...rim) - Math.min(...rim)) / outer).toBeGreaterThan(0.25);
  });

  it('runs a short way downhill when asked, and stays a round blob when not', () => {
    const extent = (run: number) => {
      const vs = verticesOf(buildStain({ size, run, direction, seed: 5 }));
      return { down: Math.max(...vs.map(along)), up: -Math.min(...vs.map(along)) };
    };
    const runner = extent(1);
    expect(runner.down).toBeGreaterThan(runner.up * 1.6);
    expect(runner.down).toBeLessThan(size * 4);
    const blob = extent(0);
    expect(blob.down).toBeLessThan(blob.up * 1.6);
  });

  it('is thinner and darker at its edges than in its middle, and never as thick as a pool', () => {
    const geometry = buildStain({ size, run: 0.5, direction, seed: 1 });
    const t = thicknessOf(geometry);
    expect(t[0]).toBeGreaterThan(0.3);
    expect(Math.max(...t)).toBeLessThanOrEqual(0.6);
    expect(Math.min(...t.slice(-48))).toBe(0);
  });

  it('faces up', () => {
    expect(upwardness(buildStain({ size, run: 0.7, direction, seed: 4 }))).toBeGreaterThan(0);
  });
});
