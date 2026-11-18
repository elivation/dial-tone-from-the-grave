import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import * as THREE from 'three';
import { bookCorners, fogDensityFor, frameCamera, PHONE_CORNERS } from './cameraFraming';
import { CAMERA_FOV, FOG_DENSITY } from './sceneConstants';

/** Where a point lands on screen, -1 to 1 either way, for a camera placed by frameCamera. */
function project(point: THREE.Vector3, aspect: number, bookOpen: boolean) {
  const { position, target } = frameCamera(aspect, CAMERA_FOV, bookOpen);
  const camera = new THREE.PerspectiveCamera(CAMERA_FOV, aspect, 0.005, 10);
  camera.position.copy(position);
  camera.lookAt(target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();
  return point.clone().project(camera);
}

const VIEWPORTS = [
  [1440, 900],
  [1280, 720],
  [390, 844],
  [844, 390],
] as const;

const LANDSCAPE = VIEWPORTS.filter(([w, h]) => w >= h);
const PORTRAIT = VIEWPORTS.filter(([w, h]) => w < h);
const distanceOf = (f: ReturnType<typeof frameCamera>) => f.position.distanceTo(f.target);
describe('frameCamera', () => {
  it.each(VIEWPORTS)('[Req 5.3] the whole book is on screen at %i by %i', (w, h) => {
    for (const corner of bookCorners()) {
      const p = project(corner, w / h, true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
  });

  it.each(LANDSCAPE)('[Req 5.3] the phone stays whole beside the open book at %i by %i', (w, h) => {
    for (const corner of PHONE_CORNERS) {
      const p = project(corner, w / h, true);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
    }
  });

  it.each(PORTRAIT)(
    '[Req 13.2] the open book fills the width of a portrait screen, %i by %i',
    (w, h) => {
      const xs = bookCorners().map((corner) => Math.abs(project(corner, w / h, true).x));
      expect(Math.max(...xs)).toBeGreaterThan(0.85);
      expect(Math.max(...xs)).toBeLessThanOrEqual(1);
    },
  );
  it.each(PORTRAIT)(
    '[Req 13.2] in portrait the camera comes in closer than for the phone alone, %i by %i',
    (w, h) => {
      const aspect = w / h;
      expect(distanceOf(frameCamera(aspect, CAMERA_FOV, true))).toBeLessThan(
        distanceOf(frameCamera(aspect, CAMERA_FOV, false)) * 0.8,
      );
    },
  );
  it('[Req 13.2] for any portrait shape the book fills the width and the phone may be cropped', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.35, max: 0.99, noNaN: true }), (aspect) => {
        const projected = bookCorners().map((corner) => project(corner, aspect, true));
        expect(Math.max(...projected.map((p) => Math.abs(p.x)))).toBeGreaterThan(0.85);
        for (const p of projected) {
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        }
      }),
    );
  });
  it('[Req 5.3] for any window shape the open book fits, and in landscape the camera never moves closer than for the phone alone', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.4, max: 3, noNaN: true }), (aspect) => {
        for (const corner of bookCorners()) {
          const p = project(corner, aspect, true);
          expect(Math.abs(p.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(p.y)).toBeLessThanOrEqual(1);
        }
        if (aspect < 1) return;
        const closed = frameCamera(aspect, CAMERA_FOV, false);
        const open = frameCamera(aspect, CAMERA_FOV, true);
        expect(distanceOf(open)).toBeGreaterThanOrEqual(distanceOf(closed) - 1e-9);
      }),
    );
  });

  it('[Req 5.3] with no book the phone is framed as before', () => {
    const { position, target } = frameCamera(1.6, CAMERA_FOV, false);
    expect(target.distanceTo(new THREE.Vector3(0.05, 0.055, 0))).toBeCloseTo(0, 9);
    expect(position.distanceTo(new THREE.Vector3(-0.06, 0.2, 0.5))).toBeCloseTo(0, 9);
  });

  it('[Req 5.3] the fog thins as the camera backs away, so a far view is not swallowed by it', () => {
    const near = frameCamera(1.6, CAMERA_FOV, false);
    const far = frameCamera(1.0, CAMERA_FOV, true);
    const distance = (f: ReturnType<typeof frameCamera>) => f.position.distanceTo(f.target);
    expect(distance(far)).toBeGreaterThan(distance(near));
    expect(fogDensityFor(distance(far))).toBeLessThan(fogDensityFor(distance(near)));
    // What reaches the eye from the phone is the same wherever the camera stands.
    for (const f of [near, far]) {
      expect(fogDensityFor(distance(f)) * distance(f)).toBeCloseTo(FOG_DENSITY * 0.53, 1);
    }
  });
});
