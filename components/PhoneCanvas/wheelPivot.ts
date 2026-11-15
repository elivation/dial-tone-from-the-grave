import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';

/**
 * Returns a function that turns the finger wheel to a given angle, in degrees clockwise from rest.
 *
 * The model is tilted, so the wheel's own z axis is not the dial axis. The turn is about the dial
 * normal, through the dial centre, in world space. Anything attached to the wheel, such as the goo,
 * goes with it.
 */
export function createWheelPivot(
  wheel: THREE.Object3D,
  dial: DialGeometry,
): (degrees: number) => void {
  wheel.updateWorldMatrix(true, false);
  const restLocal = wheel.matrix.clone();
  const parentWorld = wheel.parent ? wheel.parent.matrixWorld.clone() : new THREE.Matrix4();
  const parentWorldInverse = parentWorld.clone().invert();

  const toOrigin = new THREE.Matrix4().makeTranslation(
    -dial.centre.x,
    -dial.centre.y,
    -dial.centre.z,
  );
  const fromOrigin = new THREE.Matrix4().makeTranslation(
    dial.centre.x,
    dial.centre.y,
    dial.centre.z,
  );
  const turn = new THREE.Matrix4();
  const local = new THREE.Matrix4();

  return (degrees: number) => {
    // Looking at the dial, clockwise is a negative turn about a normal that points at the viewer.
    turn.makeRotationAxis(dial.normal, -THREE.MathUtils.degToRad(degrees));
    // world turn = move centre to origin, turn, move back. Then take it into the wheel's parent space.
    local
      .copy(parentWorldInverse)
      .multiply(fromOrigin)
      .multiply(turn)
      .multiply(toOrigin)
      .multiply(parentWorld)
      .multiply(restLocal);
    local.decompose(wheel.position, wheel.quaternion, wheel.scale);
    wheel.updateMatrix();
  };
}
