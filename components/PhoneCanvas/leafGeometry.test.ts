import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { BOOK_H, BOOK_W, pageHeight } from './bookGeometry';
import { createBackGeometry, createLeafGeometry, poseLeaf } from './leafGeometry';

function vertices(geometry: THREE.BufferGeometry) {
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  return Array.from({ length: position.count }, (_, i) => ({
    x: position.getX(i),
    y: position.getY(i),
    z: position.getZ(i),
    u: uv.getX(i),
    v: uv.getY(i),
  }));
}

describe('leaf geometry', () => {
  it('[Req 13.2] at rest forward it lies exactly on the right page, so nothing jumps when the turn starts', () => {
    const geometry = createLeafGeometry();
    poseLeaf(geometry, 1, 0);
    for (const { x, y, z, u, v } of vertices(geometry)) {
      expect(x).toBeCloseTo(u * BOOK_W, 6);
      expect(y).toBeCloseTo(pageHeight(u, v) + 0.0004, 6);
      expect(z).toBeCloseTo((0.5 - v) * BOOK_H, 6);
    }
  });

  it('[Req 13.2] at the end forward it lies on the left page, at the same height', () => {
    const geometry = createLeafGeometry();
    poseLeaf(geometry, 1, 1);
    for (const { x, y, u, v } of vertices(geometry)) {
      expect(x).toBeCloseTo(-u * BOOK_W, 6);
      expect(y).toBeCloseTo(pageHeight(u, v) + 0.0004, 6);
    }
  });

  it('[Req 13.2] half way it stands clear of the page, and lights it with normals that follow the bend', () => {
    const geometry = createLeafGeometry();
    poseLeaf(geometry, 1, 0.5);
    expect(Math.max(...vertices(geometry).map((vertex) => vertex.y))).toBeGreaterThan(BOOK_W * 0.6);
    const normal = geometry.getAttribute('normal');
    expect(
      Array.from({ length: normal.count }, (_, i) => normal.getY(i)).some((y) => y < 0.9),
    ).toBe(true);
  });

  it('[Req 13.2] the back shares the leaf positions but reads the texture from the spine outwards the other way', () => {
    const front = createLeafGeometry();
    const back = createBackGeometry(front);
    poseLeaf(front, -1, 0.3);
    expect(back.getAttribute('position')).toBe(front.getAttribute('position'));
    const f = vertices(front);
    const b = vertices(back);
    f.forEach((vertex, i) => {
      expect(b[i]?.u).toBeCloseTo(1 - vertex.u, 9);
      expect(b[i]?.v).toBeCloseTo(vertex.v, 9);
    });
  });
});
