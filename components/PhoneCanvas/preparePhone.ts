import * as THREE from 'three';
import { computeDialGeometry, type DialGeometry } from './dialGeometry';
import { addDust } from './dust';
import { buildGoo, holeOpenings, worldVertices, type HoleOpening } from './goo';
import { addBodyGoo } from './gooBody';
import {
  planPlatePrints,
  planWheelFilm,
  type DecalSpace,
  type FilmPlan,
  type Stroke,
} from './gooDecals';
import { addPlateGooUv, buildWheelFilm } from './gooFilm';
import { addSpills } from './gooSpill';
import { radiusInDial } from './dialSpace';
import { DUST_AMOUNT, PHONE_ROTATION_Y, PHONE_WIDTH } from './sceneConstants';

export type PreparedPhone = {
  /** The phone, scaled, placed on the desk and turned. Add this to the scene. */
  object: THREE.Group;
  /** Centre, normal, axes and holes of the finger wheel, in world space. */
  dial: DialGeometry;
  wheel: THREE.Mesh;
  /** The card in the middle of the dial. Undefined if the model has none. */
  card: THREE.Mesh | undefined;
  /** The number plate under the wheel, with its flat goo mapping. */
  plate: THREE.Mesh | undefined;
  /** Pools in the holes, globs on the webs and a strand. A child of the wheel, so they turn with it. */
  goo: THREE.Group;
  /**
   * Goo on the parts that never move: leak stains on the plate, the finger stop, splatter, and the
   * run down the front to a puddle on the desk. A child of the static phone body.
   */
  bodyGoo: THREE.Group;
  /** What the painter needs to paint goo onto the wheel's face and the plate. */
  decals: GooDecals;
};

export type GooDecals = {
  openings: HoleOpening[];
  fullHoles: number[];
  cardRadius: number;
  plateRadius: number;
  /** The skin over the wheel's top face that smears and streaks are painted on. */
  wheelFilm: THREE.Mesh;
  wheelSpace: DecalSpace;
  plateSpace: DecalSpace;
  film: FilmPlan;
  prints: Stroke[];
  /** Where fingers hit the finger stop. */
  stopEdge: THREE.Vector3;
};

/** Canvas size for painted goo. Kept at 1024 so updates while dragging stay quick. */
export const DECAL_SIZE = 1024;

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
  const {
    pools: goo,
    stains: bodyGoo,
    fullHoles,
    cardRadius,
    poolTops,
    poolRadii,
    material,
  } = buildGoo({
    dial,
    wheel,
    plate,
    card,
  });
  bodyGoo.name = 'goo-body';
  const { stopEdge } = addBodyGoo({ dial, object, wheel, stop, group: bodyGoo });

  const openings = holeOpenings(dial);
  const plateRadius = plate
    ? Math.max(...worldVertices(plate).map((v) => radiusInDial(v, dial)))
    : dial.radius * 1.5;
  const wheelSpace = { extent: dial.radius * 1.02, size: DECAL_SIZE };
  const plateSpace = { extent: plateRadius * 1.01, size: DECAL_SIZE };
  const wheelFilm = buildWheelFilm(wheel, dial, wheelSpace.extent);
  if (plate) addPlateGooUv(plate, dial, plateSpace.extent);
  const film = planWheelFilm({
    openings,
    fullHoles,
    dialRadius: dial.radius,
    cardRadius,
    seed: 5,
  });
  addSpills({ dial, wheel, group: goo, material, openings, film, poolTops, poolRadii });
  const prints = planPlatePrints({ dialRadius: dial.radius, plateRadius, cardRadius, seed: 8 });

  // attach keeps each group where it is in the world. The wheel goo then turns with the wheel, the body goo stays put.
  wheel.attach(goo);
  object.attach(bodyGoo);
  return {
    object,
    dial,
    wheel,
    card,
    plate,
    goo,
    bodyGoo,
    decals: {
      openings,
      fullHoles,
      cardRadius,
      plateRadius,
      wheelFilm,
      wheelSpace,
      plateSpace,
      film,
      prints,
      stopEdge,
    },
  };
}
