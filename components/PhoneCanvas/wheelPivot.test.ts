// @vitest-environment node
/**
 * [Req 1.1, 1.3] The finger wheel turns about the dial's own axis.
 *
 * The model is tilted, so its local z axis is not the dial axis. These tests turn the
 * real wheel and follow the goo that rides on it, to prove the turn is about the dial normal
 * through the dial centre.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as fc from 'fast-check';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { angleInDial, radiusInDial } from './dialSpace';
import { createWheelPivot } from './wheelPivot';
import { angleGap } from './__fixtures__/dial';
import { loadSourcePhone } from './__fixtures__/loadSource';

let phone: PreparedPhone;
let pools: THREE.Object3D[];
let rest: THREE.Vector3[];
let gooMeshes: THREE.Object3D[];
let gooRest: THREE.Vector3[];
let drips: THREE.Object3D[];
let dripRest: THREE.Matrix4[];

const worldPositions = () =>
  pools.map((p) => {
    p.updateWorldMatrix(true, false);
    return new THREE.Vector3().setFromMatrixPosition(p.matrixWorld);
  });

const positionOf = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
};
const matrixOf = (o: THREE.Object3D) => {
  o.updateWorldMatrix(true, false);
  return o.matrixWorld.clone();
};

beforeAll(async () => {
  phone = preparePhone(await loadSourcePhone());
  pools = [];
  phone.goo.traverse((o) => {
    if (o.name === 'goo-pool') pools.push(o);
  });
  rest = worldPositions();
  gooMeshes = [];
  phone.goo.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) gooMeshes.push(o);
  });
  gooRest = gooMeshes.map(positionOf);
  drips = [];
  phone.drips.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) drips.push(o);
  });
  dripRest = drips.map(matrixOf);
}, 60_000);

describe('createWheelPivot', () => {
  it('turns every hole clockwise by the angle asked for', () => {
    const turn = createWheelPivot(phone.wheel, phone.dial);
    turn(40);
    phone.object.updateMatrixWorld(true);
    worldPositions().forEach((after, i) => {
      const before = rest[i] as THREE.Vector3;
      const shift =
        (((angleInDial(after, phone.dial) - angleInDial(before, phone.dial)) % 360) + 360) % 360;
      expect(angleGap(shift, 40)).toBeLessThan(0.5);
    });
    turn(0);
  });

  it('keeps every hole the same distance from the centre and the same height off the dial face', () => {
    const turn = createWheelPivot(phone.wheel, phone.dial);
    fc.assert(
      fc.property(fc.double({ min: 0, max: 330, noNaN: true }), (degrees) => {
        turn(degrees);
        phone.object.updateMatrixWorld(true);
        const ok = worldPositions().every((after, i) => {
          const before = rest[i] as THREE.Vector3;
          const heightBefore = before.clone().sub(phone.dial.centre).dot(phone.dial.normal);
          const heightAfter = after.clone().sub(phone.dial.centre).dot(phone.dial.normal);
          return (
            Math.abs(radiusInDial(after, phone.dial) - radiusInDial(before, phone.dial)) < 1e-7 &&
            Math.abs(heightAfter - heightBefore) < 1e-7
          );
        });
        return ok;
      }),
      { numRuns: 25 },
    );
    turn(0);
  });

  it('puts everything back exactly where it was at rest', () => {
    const turn = createWheelPivot(phone.wheel, phone.dial);
    turn(200);
    turn(0);
    phone.object.updateMatrixWorld(true);
    worldPositions().forEach((after, i) => {
      expect(after.distanceTo(rest[i] as THREE.Vector3)).toBeLessThan(1e-9);
    });
  });

  it('is not the same as turning the wheel about its own z axis, which is tilted off the dial axis', () => {
    // Guards the reason this module exists: the model's local z is not the dial normal.
    const zAxis = new THREE.Vector3(0, 0, 1).transformDirection(phone.wheel.matrixWorld);
    const offAxisDegrees = THREE.MathUtils.radToDeg(
      Math.acos(Math.min(1, Math.abs(zAxis.dot(phone.dial.normal)))),
    );
    // More than a degree off, so turning about z would visibly wobble the wheel.
    expect(offAxisDegrees).toBeGreaterThan(1);
    console.info(`wheel local z is ${offAxisDegrees.toFixed(1)} degrees off the dial normal`);
  });
});

describe('goo while the wheel turns', () => {
  const turn = () => createWheelPivot(phone.wheel, phone.dial);

  it('[Req 1.1] carries every pool and smear round with the wheel, about the dial normal', () => {
    const rotate = turn();
    rotate(90);
    phone.object.updateMatrixWorld(true);
    const quarter = new THREE.Quaternion().setFromAxisAngle(
      phone.dial.normal,
      -THREE.MathUtils.degToRad(90),
    );
    gooMeshes.forEach((mesh, i) => {
      const expected = (gooRest[i] as THREE.Vector3)
        .clone()
        .sub(phone.dial.centre)
        .applyQuaternion(quarter)
        .add(phone.dial.centre);
      expect(positionOf(mesh).distanceTo(expected)).toBeLessThan(1e-6);
    });
    rotate(0);
  });

  it('[Req 1.1] leaves every drip exactly where it was, in position and orientation', () => {
    const rotate = turn();
    rotate(90);
    phone.object.updateMatrixWorld(true);
    drips.forEach((drip, i) => {
      const before = dripRest[i] as THREE.Matrix4;
      const after = matrixOf(drip);
      after.elements.forEach((e, k) =>
        expect(Math.abs(e - (before.elements[k] ?? 0))).toBeLessThan(1e-6),
      );
    });
    rotate(0);
  });

  it('never moves a drip, whatever the wheel angle', () => {
    const rotate = turn();
    fc.assert(
      fc.property(fc.double({ min: 0, max: 330, noNaN: true }), (degrees) => {
        rotate(degrees);
        phone.object.updateMatrixWorld(true);
        return drips.every((drip, i) => {
          const before = dripRest[i] as THREE.Matrix4;
          return matrixOf(drip).elements.every(
            (e, k) => Math.abs(e - (before.elements[k] ?? 0)) < 1e-6,
          );
        });
      }),
      { numRuns: 25 },
    );
    rotate(0);
  });
});
