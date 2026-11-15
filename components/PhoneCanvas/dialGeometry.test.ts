/**
 * [Req 1.1] The finger holes found in the 3D model line up with lib/dial.ts.
 *
 * Loads the optimised GLB, detects the holes by raycasting, and compares each
 * one with the digit it should be, by how far it travels to the finger stop.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { readFileSync } from 'fs';
import path from 'path';
import { computeDialGeometry, type DialGeometry } from './dialGeometry';
import { DIGITS, STOP_ANGLE, travelDegrees } from '@/lib/dial';

const PHONE_ROTATION_Y = -0.3;
const TOLERANCE_DEGREES = 5;

/** GLTFLoader reads a browser global when it meets a WebP texture. Geometry is all we need. */
(globalThis as unknown as { self: unknown }).self = globalThis;

async function loadPhone(): Promise<THREE.Group> {
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  const file = readFileSync(path.resolve(process.cwd(), 'public/models/we500.glb'));
  const bytes = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const gltf = await loader.parseAsync(bytes, '');
  const phone = gltf.scene;

  // Same placement as the scene: 23 cm wide, sitting on the desk, turned 0.3 rad.
  const size = new THREE.Box3().setFromObject(phone).getSize(new THREE.Vector3());
  phone.scale.setScalar(0.23 / Math.max(size.x, size.z));
  const box = new THREE.Box3().setFromObject(phone);
  const middle = box.getCenter(new THREE.Vector3());
  phone.position.set(-middle.x, -box.min.y, -middle.z);
  phone.rotation.y = PHONE_ROTATION_Y;
  phone.updateMatrixWorld(true);
  return phone;
}

function findMesh(root: THREE.Object3D, pattern: RegExp): THREE.Mesh {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && pattern.test(o.name)) found = o as THREE.Mesh;
  });
  if (!found) throw new Error(`No mesh matching ${pattern} in we500.glb`);
  return found;
}

const wrap360 = (a: number) => ((a % 360) + 360) % 360;

describe('[Req 1.1] dialGeometry', () => {
  let geometry: DialGeometry;

  beforeAll(async () => {
    const phone = await loadPhone();
    geometry = computeDialGeometry(
      findMesh(phone, /Finger_Wheel/),
      PHONE_ROTATION_Y,
      findMesh(phone, /Finger_Stop/),
    );
  });

  it('finds exactly 10 finger holes', () => {
    expect(geometry.holeAngles).toHaveLength(10);
  });

  it('puts every hole within 5 degrees of its HOLE_ANGLES entry in dial space', () => {
    // Travel to the stop runs 60 (digit 1) to 330 (digit 0), so sorting by it pairs holes with digits.
    const detected = geometry.holeAngles.map((a) => wrap360(STOP_ANGLE - a)).sort((a, b) => a - b);
    const expected = DIGITS.map((d) => travelDegrees(d)).sort((a, b) => a - b);

    detected.forEach((travel, i) => {
      const want = expected[i] ?? 0;
      expect(
        Math.abs(travel - want),
        `hole ${i + 1}: travels ${travel.toFixed(1)} degrees, expected ${want}`,
      ).toBeLessThanOrEqual(TOLERANCE_DEGREES);
    });
  });

  it('has a unit normal and perpendicular in-plane axes', () => {
    const { normal, uAx, rAx } = geometry;
    expect(normal.length()).toBeCloseTo(1, 5);
    expect(uAx.dot(normal)).toBeCloseTo(0, 5);
    expect(rAx.dot(normal)).toBeCloseTo(0, 5);
    expect(uAx.dot(rAx)).toBeCloseTo(0, 5);
  });
});
