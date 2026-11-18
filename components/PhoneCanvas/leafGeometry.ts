import * as THREE from 'three';
import { BOOK_H, BOOK_W, pageHeight } from './bookGeometry';
import { leafProfile } from './pageTurn';

const COLUMNS = 32;
const ROWS = 10;
/** The leaf rides this far above the page it lies on, so the two never fight over a pixel. */
const LIFT = 0.0004;

/**
 * The page that turns, as a sheet laid out like the right page: `u` is 0 at the spine and 1 at
 * the outer edge. Its pose is rewritten by `poseLeaf`, so it is made once and reused.
 */
export function createLeafGeometry(): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(BOOK_W, BOOK_H, COLUMNS, ROWS);
  poseLeaf(geometry, 1, 0);
  return geometry;
}

/**
 * The underside of the leaf. It shares the leaf's positions and normals, so posing the leaf poses
 * both, and its `u` runs the other way so the left page's picture reads from the spine outwards.
 */
export function createBackGeometry(front: THREE.BufferGeometry): THREE.BufferGeometry {
  const back = new THREE.BufferGeometry();
  back.setAttribute('position', front.getAttribute('position'));
  back.setAttribute('normal', front.getAttribute('normal'));
  const uv = front.getAttribute('uv');
  const flipped = new Float32Array(uv.count * 2);
  for (let i = 0; i < uv.count; i++) {
    flipped[i * 2] = 1 - uv.getX(i);
    flipped[i * 2 + 1] = uv.getY(i);
  }
  back.setAttribute('uv', new THREE.BufferAttribute(flipped, 2));
  back.setIndex(front.getIndex());
  return back;
}

/** Bends the leaf to `progress` through a turn, 0 to 1. Writes the buffers and nothing else. */
export function poseLeaf(
  geometry: THREE.BufferGeometry,
  direction: 1 | -1,
  progress: number,
): void {
  const { x, y } = leafProfile(direction, progress, COLUMNS, BOOK_W);
  const position = geometry.getAttribute('position');
  const uv = geometry.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const column = Math.round(uv.getX(i) * COLUMNS);
    const v = uv.getY(i);
    const across = Math.min(1, Math.abs(x[column]!) / BOOK_W);
    position.setXYZ(i, x[column]!, y[column]! + pageHeight(across, v) + LIFT, (0.5 - v) * BOOK_H);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.getAttribute('normal').needsUpdate = true;
}
