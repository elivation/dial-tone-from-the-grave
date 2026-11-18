import * as THREE from 'three';
import { BLOCK, BOOK_H, BOOK_W } from './bookGeometry';
import { BOOK_POSITION, BOOK_ROTATION_Y, BOOK_SCALE, FOG_DENSITY } from './sceneConstants';

export type CameraFraming = { position: THREE.Vector3; target: THREE.Vector3 };

const TARGET = new THREE.Vector3(0.05, 0.055, 0);
const HOME = new THREE.Vector3(-0.06, 0.2, 0.5);
/** The view must show at least this much of the desk, so the phone is never cut off on a tall screen. */
const MIN_VISIBLE_WIDTH = 0.3;
/** With the book open the camera looks at the middle of the phone and book together. */
const BOOK_TARGET = new THREE.Vector3(0.03, 0.025, 0.07);
/** On a portrait screen the camera looks at the middle of the book alone. */
const BOOK_ONLY_TARGET = new THREE.Vector3(BOOK_POSITION[0], 0.03, BOOK_POSITION[2]);
/** The nearest the camera may come to the book, in metres. */
const CLOSEST = 0.1;
/** How much of the screen the book and phone may fill, so nothing sits right on the edge. */
const FILL = 0.94;

/** A box round the phone, rough on purpose: it only has to stop the phone being cut off. */
export const PHONE_CORNERS: readonly THREE.Vector3[] = corners(-0.12, 0.12, 0, 0.11, -0.1, 0.1);

function corners(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
  return [x0, x1].flatMap((x) =>
    [y0, y1].flatMap((y) => [z0, z1].map((z) => new THREE.Vector3(x, y, z))),
  );
}

/** The corners of a box round the open book, in the world, covers and page block included. */
export function bookCorners(): THREE.Vector3[] {
  const halfW = BOOK_W + 0.012;
  const halfD = (BOOK_H + 0.012) / 2;
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...BOOK_POSITION),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(0, BOOK_ROTATION_Y, 0)),
    new THREE.Vector3(BOOK_SCALE, BOOK_SCALE, BOOK_SCALE),
  );
  return corners(-halfW, halfW, 0, BLOCK + 0.005, -halfD, halfD).map((c) => c.applyMatrix4(matrix));
}

function fits(points: readonly THREE.Vector3[], camera: THREE.PerspectiveCamera) {
  camera.updateMatrixWorld();
  return points.every((point) => {
    const p = point.clone().project(camera);
    return Math.abs(p.x) <= FILL && Math.abs(p.y) <= FILL;
  });
}

/**
 * Where the camera goes. It always looks along the same line at the desk. On narrow screens it
 * backs away to keep the phone whole. With the book open on a landscape screen it also backs
 * away, as far as it takes for the book and the phone to fit with a margin. On a portrait screen
 * the phone is given up instead: the camera comes in until the book alone fills the width, so the
 * book is as big as the screen allows and the phone may be cropped.
 */
export function frameCamera(aspect: number, fov: number, bookOpen: boolean): CameraFraming {
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const offset = HOME.clone().sub(TARGET);
  const needed = MIN_VISIBLE_WIDTH / (2 * halfHeight * aspect);
  const closed = offset.clone().multiplyScalar(Math.max(1, needed / offset.length()));
  if (!bookOpen) return { position: TARGET.clone().add(closed), target: TARGET.clone() };

  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.005, 10);
  const portrait = aspect < 1;
  const points = portrait ? bookCorners() : [...bookCorners(), ...PHONE_CORNERS];
  const target = portrait ? BOOK_ONLY_TARGET : BOOK_TARGET;
  const direction = offset.clone().normalize();
  // Landscape only ever backs away from the phone-only view. Portrait starts close and backs away
  // until the book just fits, so it stops at the closest view that shows all of it.
  for (
    let distance = portrait ? CLOSEST : closed.length();
    distance < 5;
    distance *= portrait ? 1.005 : 1.02
  ) {
    camera.position.copy(target).addScaledVector(direction, distance);
    camera.lookAt(target);
    if (fits(points, camera)) break;
  }
  return { position: camera.position.clone(), target: target.clone() };
}

/**
 * Fog is tuned for the home distance. Further back it would swallow the whole desk, so it thins in
 * proportion and the view looks the same, just smaller.
 */
export function fogDensityFor(distance: number): number {
  const home = HOME.distanceTo(TARGET);
  return FOG_DENSITY * Math.min(1, home / distance);
}
