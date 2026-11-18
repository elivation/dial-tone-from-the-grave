import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FLIP_STRIP } from './flipStrip';

/** Metres, as in the reference scene assets-src/book-test.html. One page is this big. */
export const BOOK_W = 0.21;
export const BOOK_H = 0.28;
/** Height of the closed block of pages under the open ones. */
export const BLOCK = 0.045;
const SEGMENTS_X = 60;
const SEGMENTS_Y = 40;

/** The height of the page surface at `t`, 0 at the spine to 1 at the outer edge: it sags into the gutter. */
const baseHeight = (t: number) =>
  BLOCK - 0.002 + Math.sqrt(Math.max(0, t)) * 0.004 - Math.exp(-t * 14) * 0.012;

/** The page surface with a faint wave along its length. `v` runs 0 at the bottom of the page to 1 at the top. */
export function pageHeight(t: number, v: number): number {
  return baseHeight(t) + Math.sin(t * 9 + v * 3) * 0.0006;
}

/** One page as a bent sheet. The right page also curls up at its bottom outer corner. */
export function pageGeometry(side: 'L' | 'R'): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(BOOK_W, BOOK_H, SEGMENTS_X, SEGMENTS_Y);
  const position = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const t = side === 'L' ? 1 - u : u;
    const curl =
      side === 'R' && t > 0.9 && v < 0.12
        ? Math.pow((t - 0.9) * 10, 2) * Math.pow((0.12 - v) / 0.12, 2) * 0.012
        : 0;
    const x = t * BOOK_W;
    position.setXYZ(i, side === 'L' ? -x : x, pageHeight(t, v) + curl, (0.5 - v) * BOOK_H);
  }
  geo.computeVertexNormals();
  return geo;
}

/**
 * A thin sheet that lies just above the flip strip along a page's outer edge. Its `u` runs 0 at the
 * strip's inner edge to 1 at the page edge on both sides, so one gradient serves both.
 */
export function flipStripGeometry(side: 'L' | 'R'): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(BOOK_W * FLIP_STRIP, BOOK_H, 4, SEGMENTS_Y / 2);
  const position = geo.getAttribute('position');
  const uv = geo.getAttribute('uv');
  for (let i = 0; i < position.count; i++) {
    const along = uv.getX(i);
    const v = uv.getY(i);
    const t = 1 - FLIP_STRIP + along * FLIP_STRIP;
    const x = t * BOOK_W;
    position.setXYZ(i, side === 'L' ? -x : x, pageHeight(t, v) + 0.0004, (0.5 - v) * BOOK_H);
  }
  geo.computeVertexNormals();
  return geo;
}
/** The block of pages under one side: its top follows the page, its edge shows the stripes. */
export function blockGeometry(side: 'L' | 'R'): THREE.ExtrudeGeometry {
  const profile = new THREE.Shape();
  profile.moveTo(0, 0.004);
  for (let k = 0; k <= SEGMENTS_X; k++) {
    const t = k / SEGMENTS_X;
    profile.lineTo(t * BOOK_W, baseHeight(t) - 0.0015);
  }
  profile.lineTo(BOOK_W, 0.004);
  profile.lineTo(0, 0.004);
  const depth = BOOK_H * 0.995;
  const geo = new THREE.ExtrudeGeometry(profile, { depth, bevelEnabled: false, steps: 1 });
  geo.translate(0, 0, -depth / 2);
  if (side === 'L') geo.scale(-1, 1, 1);
  return geo;
}

/** A cover board, a little bigger than a page. */
export function coverGeometry(): THREE.BoxGeometry {
  return new THREE.BoxGeometry(BOOK_W + 0.012, 0.004, BOOK_H + 0.012);
}

/** Where the cover sits for side `s`, -1 for the left and 1 for the right. */
export const coverX = (s: -1 | 1) => s * (BOOK_W / 2 + 0.004);

const UP = new THREE.Vector3(0, 1, 0);
const SEGMENTS = 34;

/**
 * The centipede crawling out of the gutter onto the right page. Its body segments are merged into
 * one mesh and its legs and antennae into another, so it costs two draw calls.
 */
export function buildCentipede(): { group: THREE.Group; dispose: () => void } {
  const points: THREE.Vector3[] = [];
  for (let k = 0; k <= 30; k++) {
    const x = 0.002 + k * 0.0033;
    points.push(
      new THREE.Vector3(x, baseHeight(x / BOOK_W) + 0.0028, 0.04 + Math.sin(k * 0.4) * 0.012),
    );
  }
  const curve = new THREE.CatmullRomCurve3(points);
  const bodyParts: THREE.BufferGeometry[] = [];
  const legParts: THREE.BufferGeometry[] = [];
  const sideOf = (tangent: THREE.Vector3) =>
    new THREE.Vector3().crossVectors(tangent, UP).normalize();

  for (let k = 0; k < SEGMENTS; k++) {
    const f = k / (SEGMENTS - 1);
    const p = curve.getPoint(f);
    const tangent = curve.getTangent(f);
    const sphere = new THREE.SphereGeometry(0.0019 * (1 - Math.abs(f - 0.6) * 0.6), 14, 8);
    const orient = new THREE.Object3D();
    orient.scale.set(1.35, 0.45, 2.0);
    orient.position.copy(p);
    orient.lookAt(p.clone().add(tangent));
    orient.updateMatrix();
    sphere.applyMatrix4(orient.matrix);
    bodyParts.push(sphere);
    const side = sideOf(tangent);
    for (const s of [-1, 1]) {
      const a = p.clone();
      const b = p
        .clone()
        .addScaledVector(side, s * 0.0042)
        .add(new THREE.Vector3(0, 0.0013, 0))
        .addScaledVector(tangent, -0.0008);
      const e = p
        .clone()
        .addScaledVector(side, s * 0.0068)
        .add(new THREE.Vector3(0, -0.0016, 0))
        .addScaledVector(tangent, -0.0022);
      legParts.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b, e]), 8, 0.00016, 4));
    }
  }
  const head = curve.getPoint(1);
  const tangent = curve.getTangent(1);
  const side = sideOf(tangent);
  for (const s of [-1, 1]) {
    const mid = head
      .clone()
      .addScaledVector(tangent, 0.006)
      .addScaledVector(side, s * 0.003)
      .add(new THREE.Vector3(0, 0.003, 0));
    const tip = head
      .clone()
      .addScaledVector(tangent, 0.012)
      .addScaledVector(side, s * 0.007)
      .add(new THREE.Vector3(0, 0.0015, 0));
    legParts.push(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3([head, mid, tip]), 12, 0.00014, 4),
    );
  }

  const bodyGeo = mergeGeometries(bodyParts);
  const legGeo = mergeGeometries(legParts);
  for (const part of [...bodyParts, ...legParts]) part.dispose();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c0e07,
    roughness: 0.35,
    clearcoat: 1,
    clearcoatRoughness: 0.15,
  });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x8a6a3a, roughness: 0.6 });
  const group = new THREE.Group();
  group.name = 'centipede';
  for (const mesh of [new THREE.Mesh(bodyGeo, bodyMat), new THREE.Mesh(legGeo, legMat)]) {
    mesh.castShadow = true;
    group.add(mesh);
  }
  return {
    group,
    dispose: () => {
      bodyGeo.dispose();
      legGeo.dispose();
      bodyMat.dispose();
      legMat.dispose();
    },
  };
}
