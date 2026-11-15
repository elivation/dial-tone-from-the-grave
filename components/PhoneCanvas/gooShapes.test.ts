import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import { buildDrip, buildPool, buildSmear, dripProfile } from './gooShapes';

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

describe('dripProfile', () => {
  it('tapers to a neck, then swells into a fat bead that is the widest part', () => {
    const start = dripProfile(0).width;
    const neck = dripProfile(0.55).width;
    const bead = dripProfile(0.84).width;
    expect(start).toBeGreaterThan(neck * 1.6);
    expect(bead).toBeGreaterThan(neck * 1.9);
    // Not a goblet: the bead is wider than where the drip leaves the rim.
    expect(bead).toBeGreaterThan(start);
  });

  it('closes to a rounded point at the end', () => {
    expect(dripProfile(1).width).toBe(0);
    expect(dripProfile(1).height).toBe(0);
    // Round, not pointed: the width falls away steeply only in the last stretch.
    expect(dripProfile(0.95).width).toBeGreaterThan(dripProfile(0.99).width);
  });

  it('stays low, so it hugs the surface', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1, noNaN: true }), (s) => {
        const { width, height } = dripProfile(s);
        return height <= width * 0.6 + 1e-12 && width >= 0;
      }),
    );
  });
});

describe('buildDrip', () => {
  const radius = 0.004;
  const length = 0.0045;
  const direction = { x: 0.6, z: 0.8 };
  const drip = buildDrip({ radius, length, direction, seed: 3 });
  const vertices = verticesOf(drip);

  it('runs as far past its start as asked, and no further', () => {
    const along = Math.max(...vertices.map((v) => v.x * direction.x + v.z * direction.z));
    expect(along).toBeGreaterThan(length * 0.99);
    expect(along).toBeLessThan(length * 1.01);
  });

  it('never runs backwards from where it starts', () => {
    expect(Math.min(...vertices.map((v) => v.x * direction.x + v.z * direction.z))).toBeGreaterThan(
      -1e-9,
    );
  });

  it('lies on the surface, a low blob and not a wire', () => {
    expect(Math.min(...vertices.map((v) => v.y))).toBeGreaterThanOrEqual(-1e-9);
    expect(Math.max(...vertices.map((v) => v.y))).toBeLessThan(radius * 0.5);
  });

  it('is thick: wider than a quarter of a hole radius at the bead', () => {
    const side = { x: -direction.z, z: direction.x };
    const near = vertices.filter(
      (v) => Math.abs(v.x * direction.x + v.z * direction.z - length * 0.84) < length * 0.04,
    );
    const across = near.map((v) => v.x * side.x + v.z * side.z);
    expect(Math.max(...across) - Math.min(...across)).toBeGreaterThan(radius * 0.5);
  });

  it('faces up', () => {
    expect(upwardness(drip)).toBeGreaterThan(0);
  });
});

describe('buildPool', () => {
  const radius = 0.004;
  const pool = buildPool({ radius, fillHeight: 0.003, dome: 0.0006, seed: 7 });
  const vertices = verticesOf(pool);
  const floorRing = vertices.filter((v) => Math.abs(v.y) < 1e-9);

  it('has an uneven outline, not a circle', () => {
    const radii = floorRing.map((v) => Math.hypot(v.x, v.z));
    const mean = radii.reduce((a, b) => a + b, 0) / radii.length;
    expect((Math.max(...radii) - Math.min(...radii)) / mean).toBeGreaterThan(0.15);
  });

  it('fits inside the hole', () => {
    expect(Math.max(...vertices.map((v) => Math.hypot(v.x, v.z)))).toBeLessThanOrEqual(radius);
  });

  it('is a column of slime filled to the level asked, domed on top', () => {
    const top = Math.max(...vertices.map((v) => v.y));
    expect(top).toBeGreaterThan(0.003 + 0.0006 * 0.8);
    expect(top).toBeLessThan(0.003 + 0.0006 * 1.4);
    // The edge of the top surface sits at the fill level, lower than the middle.
    const centre = vertices[0];
    expect(centre?.y).toBeGreaterThan(0.003 + 0.0006 * 0.5);
  });

  it('reaches down to the floor', () => {
    expect(floorRing.length).toBeGreaterThan(20);
  });

  it('has a rounded shoulder, not a sharp edge: the top surface is drawn in from the wall', () => {
    const wall = Math.max(...floorRing.map((v) => Math.hypot(v.x, v.z)));
    const edgeOfTop = vertices.filter(
      (v) => Math.abs(v.y - 0.003) < 1e-7 && Math.hypot(v.x, v.z) > radius * 0.3,
    );
    expect(edgeOfTop.length).toBeGreaterThan(10);
    expect(Math.max(...edgeOfTop.map((v) => Math.hypot(v.x, v.z)))).toBeLessThan(wall * 0.9);
  });

  it('gets no wider as it rises, so it stays inside the hole', () => {
    for (const v of vertices) expect(Math.hypot(v.x, v.z)).toBeLessThanOrEqual(radius);
  });

  it('looks different for a different seed and the same for the same seed', () => {
    const again = verticesOf(buildPool({ radius, fillHeight: 0.003, dome: 0.0006, seed: 7 }));
    const other = verticesOf(buildPool({ radius, fillHeight: 0.003, dome: 0.0006, seed: 8 }));
    expect(again.every((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) < 1e-12)).toBe(true);
    expect(other.some((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) > 1e-4)).toBe(true);
  });

  it('faces up', () => {
    expect(upwardness(pool)).toBeGreaterThan(0);
  });
});

describe('buildSmear', () => {
  const radius = 0.004;
  const centreAngle = Math.PI / 2;
  const arc = (70 * Math.PI) / 180;
  const smear = buildSmear({
    radius,
    centreAngle,
    arc,
    height: 0.0006,
    innerDrop: 0.0003,
    seed: 5,
  });
  const vertices = verticesOf(smear);

  it('covers only part of the rim', () => {
    for (const v of vertices) {
      const angle = Math.atan2(v.z, v.x);
      const off = Math.abs(((angle - centreAngle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      // Positions are stored as 32-bit floats, good to about 7 digits, so allow for that.
      expect(off).toBeLessThanOrEqual(arc / 2 + 1e-5);
    }
  });

  it('spills over the rim and reaches back into the hole', () => {
    const reach = vertices.map((v) => Math.hypot(v.x, v.z));
    expect(Math.max(...reach)).toBeGreaterThan(radius * 1.05);
    expect(Math.min(...reach)).toBeLessThan(radius * 0.8);
  });

  it('bulges over the lip and fades flat at its outer edge', () => {
    expect(Math.max(...vertices.map((v) => v.y))).toBeGreaterThan(0.0004);
    expect(Math.max(...vertices.map((v) => v.y))).toBeLessThan(0.0008);
  });

  it('faces up', () => {
    expect(upwardness(smear)).toBeGreaterThan(0);
  });
});
