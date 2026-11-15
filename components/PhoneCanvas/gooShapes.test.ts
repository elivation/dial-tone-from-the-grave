import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  buildBlob,
  buildPool,
  buildRibbon,
  buildSpecks,
  buildStain,
  buildTube,
  poolSurface,
} from './gooShapes';

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

  it('[Req 1.1] has a few lumps in its surface, not one smooth curve', () => {
    // In the flat middle, before the meniscus climbs, so only lumps can make the difference.
    const inner = surface.filter((v) => Math.hypot(v.x, v.z) < radius * 0.45);
    const heights = inner.map((v) => v.y);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(0.00006);
  });

  it('[Req 1.1] can hold 1 to 3 small bubbles, sitting on the surface and never above the top', () => {
    const bubbly = buildPool({ radius, top, seed: 7, bubbles: 3 });
    const bubbles = bubbly.userData['bubbles'] as Array<{ x: number; z: number; r: number }>;
    expect(bubbles).toHaveLength(3);
    for (const b of bubbles) {
      expect(Math.hypot(b.x, b.z)).toBeLessThan(radius * 0.7);
      expect(b.r).toBeGreaterThan(0.00008);
      expect(b.r).toBeLessThan(0.0004);
    }
    const all = verticesOf(bubbly);
    expect(all.length).toBeGreaterThan(vertices.length);
    expect(Math.max(...all.map((v) => v.y))).toBeLessThanOrEqual(top);
  });

  it('reports the height of its own surface, so grime can be set into it', () => {
    const shape = poolSurface({ radius, top, seed: 7 });
    const middle = vertices[0] as THREE.Vector3;
    expect(shape.heightAt(0, 0)).toBeCloseTo(middle.y, 9);
    expect(shape.heightAt(radius * 0.4, 0)).toBeLessThanOrEqual(top);
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

describe('buildBlob', () => {
  const radius = 0.0012;
  const height = 0.0008;
  const blob = buildBlob({ radius, height, stretch: 1, seed: 4 });
  const vertices = verticesOf(blob);

  it('sits on the surface and is no taller than asked, give or take its lumps', () => {
    expect(Math.min(...vertices.map((v) => v.y))).toBeGreaterThanOrEqual(0);
    expect(Math.max(...vertices.map((v) => v.y))).toBeLessThanOrEqual(height * 1.2);
    expect(Math.max(...vertices.map((v) => v.y))).toBeGreaterThan(height * 0.7);
  });

  it('has a lumpy outline, never a circle', () => {
    const edge = vertices.filter((v) => v.y === 0).map((v) => Math.hypot(v.x, v.z));
    expect(Math.max(...edge) / Math.min(...edge)).toBeGreaterThan(1.25);
    expect(Math.max(...edge)).toBeLessThan(radius * 1.5);
  });

  it('is drawn out along x when stretched, as a glob on a narrow web would be', () => {
    const long = verticesOf(buildBlob({ radius, height, stretch: 1.8, seed: 4 }));
    const reachX = Math.max(...long.map((v) => Math.abs(v.x)));
    const reachZ = Math.max(...long.map((v) => Math.abs(v.z)));
    expect(reachX).toBeGreaterThan(reachZ * 1.3);
  });

  it('is the same for the same seed and different for another', () => {
    const again = verticesOf(buildBlob({ radius, height, stretch: 1, seed: 4 }));
    const other = verticesOf(buildBlob({ radius, height, stretch: 1, seed: 5 }));
    expect(again.every((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) < 1e-12)).toBe(true);
    expect(other.some((v, i) => v.distanceTo(vertices[i] as THREE.Vector3) > 1e-5)).toBe(true);
  });

  it('faces up', () => {
    expect(upwardness(blob)).toBeGreaterThan(0);
  });
});

describe('buildTube', () => {
  const path = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.002, -0.0006, 0),
    new THREE.Vector3(0.004, -0.0009, 0.0005),
    new THREE.Vector3(0.006, 0, 0.001),
  ];
  const radiusAt = (s: number) => 0.0002 + 0.0003 * Math.sin(Math.PI * s);
  const sides = 8;
  const tube = buildTube({ path, radiusAt, sides, seed: 1 });
  const vertices = verticesOf(tube);

  it('wraps each point of the path at the radius asked for there', () => {
    const rings = path.length;
    for (let i = 0; i < rings; i++) {
      const s = i / (rings - 1);
      for (let k = 0; k <= sides; k++) {
        const v = vertices[i * (sides + 1) + k] as THREE.Vector3;
        // A little noise on the surface, so the strand is not a perfect pipe.
        expect(v.distanceTo(path[i] as THREE.Vector3)).toBeGreaterThan(radiusAt(s) * 0.8);
        expect(v.distanceTo(path[i] as THREE.Vector3)).toBeLessThan(radiusAt(s) * 1.2);
      }
    }
  });

  it('records the thickest part as the thickest goo', () => {
    const t = thicknessOf(tube);
    const ring = (i: number) => t[i * (sides + 1)] ?? 0;
    expect(ring(1)).toBeGreaterThan(ring(0));
    expect(Math.max(...t)).toBeLessThanOrEqual(1);
  });
});

describe('buildRibbon', () => {
  const path = Array.from({ length: 12 }, (_, i) => ({
    point: new THREE.Vector3(0, -i * 0.002, 0),
    normal: new THREE.Vector3(0, 0, 1),
  }));
  const widthAt = () => 0.003;
  const heightAt = () => 0.0007;
  const ribbon = buildRibbon({ path, widthAt, heightAt, seed: 2 });
  const vertices = verticesOf(ribbon);

  it('lies on the surface it follows, never sunk into it, and no thicker than asked', () => {
    for (const v of vertices) {
      expect(v.z).toBeGreaterThanOrEqual(0);
      expect(v.z).toBeLessThanOrEqual(0.0007 * 1.25 + 0.00005);
    }
  });

  it('runs the length of the path and keeps within its width, with a ragged edge', () => {
    const ys = vertices.map((v) => v.y);
    expect(Math.min(...ys)).toBeLessThan(-0.02);
    const xs = vertices.map((v) => Math.abs(v.x));
    expect(Math.max(...xs)).toBeLessThanOrEqual(0.003 * 0.5 * 1.35);
    const edgeWidths = path.map((_, i) => Math.abs((vertices[i * 9] as THREE.Vector3).x));
    expect(Math.max(...edgeWidths) - Math.min(...edgeWidths)).toBeGreaterThan(0.0001);
  });

  it('drapes every point across its width onto the surface it is given', () => {
    // A surface that falls away to one side: x > 0 is 1 mm lower.
    const drape = (p: THREE.Vector3) => p.clone().setZ(p.x > 0 ? -0.001 : 0);
    const draped = verticesOf(buildRibbon({ path, widthAt, heightAt, seed: 2, drape }));
    for (const v of draped) {
      const floor = v.x > 0 ? -0.001 : 0;
      expect(v.z).toBeGreaterThanOrEqual(floor - 1e-9);
      expect(v.z).toBeLessThanOrEqual(floor + 0.0007 * 1.25 + 0.00005);
    }
  });

  it('faces the way the surface does', () => {
    const position = ribbon.getAttribute('position');
    const index = ribbon.getIndex() as THREE.BufferAttribute;
    let out = 0;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i));
      b.fromBufferAttribute(position, index.getX(i + 1));
      c.fromBufferAttribute(position, index.getX(i + 2));
      out += b.clone().sub(a).cross(c.clone().sub(a)).z;
    }
    expect(out).toBeGreaterThan(0);
  });
});

describe('buildSpecks', () => {
  const spots = [
    {
      point: new THREE.Vector3(0, 0, 0),
      normal: new THREE.Vector3(0, 1, 0),
      radius: 0.0003,
      tail: null,
    },
    {
      point: new THREE.Vector3(0.01, 0, 0),
      normal: new THREE.Vector3(0, 0, 1),
      radius: 0.0002,
      tail: new THREE.Vector3(1, 0, 0),
    },
  ];
  const specks = buildSpecks({ spots, seed: 3 });
  const vertices = verticesOf(specks);

  it('puts a small lump on each spot, on the surface there', () => {
    const half = vertices.length / 2;
    vertices.forEach((v, i) => {
      const spot = spots[i < half ? 0 : 1] as (typeof spots)[number];
      const offset = v.clone().sub(spot.point);
      expect(offset.dot(spot.normal)).toBeGreaterThanOrEqual(-1e-9);
      expect(offset.length()).toBeLessThan(spot.radius * (spot.tail ? 3 : 1.6));
    });
  });

  it('draws a speck with a tail out along it, as a splash does', () => {
    const half = vertices.length / 2;
    const second = vertices.slice(half).map((v) => v.x - 0.01);
    expect(Math.max(...second)).toBeGreaterThan(-Math.min(...second) * 1.5);
  });
});
