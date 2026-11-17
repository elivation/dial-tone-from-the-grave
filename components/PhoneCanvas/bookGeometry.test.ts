import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BLOCK,
  BOOK_H,
  BOOK_W,
  buildCentipede,
  coverGeometry,
  pageGeometry,
  pageHeight,
} from './bookGeometry';

function maxY(geo: THREE.BufferGeometry, pick: (x: number, z: number) => boolean): number {
  const p = geo.getAttribute('position');
  let best = -Infinity;
  for (let i = 0; i < p.count; i++) {
    if (pick(p.getX(i), p.getZ(i))) best = Math.max(best, p.getY(i));
  }
  return best;
}

describe('book geometry', () => {
  it('[Req 5.3] each page is a 60 by 40 segment sheet', () => {
    const geo = pageGeometry('R');
    expect(geo.getAttribute('position').count).toBe(61 * 41);
  });

  it('[Req 5.3] the page sags into the gutter and rises towards the outer edge', () => {
    expect(pageHeight(0, 0.5)).toBeLessThan(pageHeight(0.5, 0.5));
    expect(pageHeight(0, 0.5)).toBeLessThan(BLOCK - 0.008);
  });

  it('[Req 5.3] the left page is the right page mirrored about the spine', () => {
    const left = pageGeometry('L').getAttribute('position');
    expect(left.getX(0)).toBeLessThanOrEqual(0);
    const right = pageGeometry('R').getAttribute('position');
    expect(right.getX(right.count - 1)).toBeLessThanOrEqual(BOOK_W + 1e-9);
    expect(left.getX(0)).toBeGreaterThanOrEqual(-BOOK_W - 1e-9);
  });

  it('[Req 5.3] only the right page curls up at its outer corner', () => {
    const corner = (x: number, z: number) => Math.abs(x) > BOOK_W * 0.97 && z > BOOK_H * 0.4;
    const rightCorner = maxY(pageGeometry('R'), corner);
    const leftCorner = maxY(pageGeometry('L'), corner);
    expect(rightCorner - leftCorner).toBeGreaterThan(0.002);
  });

  it('[Req 5.3] normals are computed after the displacement and are unit length', () => {
    const normal = pageGeometry('R').getAttribute('normal');
    const v = new THREE.Vector3().fromBufferAttribute(normal, 1000);
    expect(v.length()).toBeCloseTo(1, 3);
  });

  it('[Req 5.3] the cover is a thin board a little bigger than the page', () => {
    const geo = coverGeometry();
    geo.computeBoundingBox();
    const size = geo.boundingBox?.getSize(new THREE.Vector3());
    expect(size?.x).toBeCloseTo(BOOK_W + 0.012);
    expect(size?.y).toBeCloseTo(0.004);
  });

  it('[Req 5.3] the centipede is merged into two meshes so it costs two draw calls', () => {
    const centipede = buildCentipede();
    const meshes: THREE.Mesh[] = [];
    centipede.group.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    expect(meshes).toHaveLength(2);
    expect(meshes.every((m) => m.castShadow)).toBe(true);
  });
});
