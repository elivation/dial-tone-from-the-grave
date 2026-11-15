import * as THREE from 'three';
import { computeDialGeometry, type DialGeometry } from './dialGeometry';
import { addDust } from './dust';
import { buildGoo } from './goo';
import { DUST_AMOUNT, PHONE_ROTATION_Y, PHONE_WIDTH } from './sceneConstants';

export type PreparedPhone = {
  /** The phone, scaled, placed on the desk and turned. Add this to the scene. */
  object: THREE.Group;
  /** Centre, normal, axes and holes of the finger wheel, in world space. */
  dial: DialGeometry;
  wheel: THREE.Mesh;
  /** The card in the middle of the dial. Undefined if the model has none. */
  card: THREE.Mesh | undefined;
  /** Goo in the finger holes. A child of the wheel, so it turns with it. */
  goo: THREE.Group;
};

function findMesh(root: THREE.Object3D, pattern: RegExp): THREE.Mesh | undefined {
  let found: THREE.Mesh | undefined;
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && pattern.test(o.name)) found = o as THREE.Mesh;
  });
  return found;
}

/** The loader caches one scene. Give this copy its own materials so changes stay here. */
function cloneMaterials(root: THREE.Object3D): void {
  const copies = new Map<THREE.Material, THREE.Material>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    let copy = copies.get(mesh.material);
    if (!copy) {
      copy = mesh.material.clone();
      copies.set(mesh.material, copy);
    }
    mesh.material = copy;
  });
}

/**
 * Turns the loaded model into what the scene needs: placed on the desk, dusty,
 * with goo in the finger holes. Leaves the source scene untouched.
 */
export function preparePhone(source: THREE.Object3D): PreparedPhone {
  const object = source.clone(true) as THREE.Group;
  cloneMaterials(object);

  const size = new THREE.Box3().setFromObject(object).getSize(new THREE.Vector3());
  object.scale.setScalar(PHONE_WIDTH / Math.max(size.x, size.z));
  const box = new THREE.Box3().setFromObject(object);
  const middle = box.getCenter(new THREE.Vector3());
  object.position.set(-middle.x, -box.min.y, -middle.z);
  object.rotation.y = PHONE_ROTATION_Y;
  object.updateMatrixWorld(true);

  const wheel = findMesh(object, /Finger_Wheel/);
  const stop = findMesh(object, /Finger_Stop/);
  if (!wheel || !stop)
    throw new Error(
      'we500.glb is missing its finger wheel or finger stop. Re-run pnpm optimize-assets.',
    );
  const plate = findMesh(object, /Number_Plate/);
  const card = findMesh(object, /Dial_Card/);

  object.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    const material = mesh.material;
    if (
      !Array.isArray(material) &&
      material instanceof THREE.MeshStandardMaterial &&
      material.name === 'Western_Electric_500_Material' &&
      !material.userData['dusted']
    ) {
      material.color.multiplyScalar(0.9);
      material.roughness = Math.min(1, material.roughness + 0.1);
      addDust(material, DUST_AMOUNT);
      material.userData['dusted'] = true;
    }
  });

  const dial = computeDialGeometry(wheel, PHONE_ROTATION_Y, stop);
  const goo = buildGoo({ dial, plate });
  // attach keeps the goo where it is in the world while making it follow the wheel.
  wheel.attach(goo);

  return { object, dial, wheel, card, goo };
}
