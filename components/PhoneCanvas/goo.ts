import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { glowWithSlimeColour, paintGoo } from './gooColour';
import { buildDrip, buildPool, buildSmear } from './gooShapes';
import { seededRandom } from './noise';
import { GOO, GOO_SHAPE } from './sceneConstants';

export type GooInput = {
  dial: DialGeometry;
  /** The number plate under the wheel. Slime stands on it, at the bottom of each hole. */
  plate: THREE.Mesh | undefined;
};

/** Radius of the open part of a finger hole, in metres. */
export function holeRadiusOf(dial: DialGeometry): number {
  return Math.sin(THREE.MathUtils.degToRad(dial.holeWidth / 2)) * dial.holeR * 0.95;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Gives each slime mesh its colour, from the thickness its shape recorded. */
function colour(geometry: THREE.BufferGeometry): void {
  const thickness = geometry.getAttribute('thickness');
  paintGoo(geometry, (i) => thickness.getX(i));
}

/**
 * Wet green slime in the finger holes. Every hole holds a column of it, filled to a different
 * level with an uneven outline. The fullest are smeared over part of the rim, and two or three of
 * those, on the lower half of the dial, run a short thick drip ending in a bead.
 *
 * Built in world space from the dial's own geometry, then attached to the wheel by the caller
 * so it turns with it.
 */
export function buildGoo({ dial, plate }: GooInput): THREE.Group {
  const { centre, normal, uAx, rAx, radius, holeR, holeAngles, faceHeight, isOpen } = dial;
  const holeRadius = holeRadiusOf(dial);
  const random = seededRandom(11);
  const raycaster = new THREE.Raycaster();
  const into = normal.clone().negate();

  // Pieces are built flat, with x to 3 o'clock, y out of the dial and z to 6 o'clock.
  const frame = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(rAx, normal, uAx.clone().negate()),
  );
  const toLocal = (v: THREE.Vector3) => ({ x: v.dot(rAx), z: -v.dot(uAx) });
  // Slime runs downhill across the face of the tilted dial.
  const downhill = new THREE.Vector3(0, -1, 0).addScaledVector(normal, normal.y).normalize();

  // White base so the vertex colours, painted by thickness, set the green.
  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: GOO.roughness,
    metalness: 0,
    clearcoat: GOO.clearcoat,
    clearcoatRoughness: GOO.clearcoatRoughness,
    emissive: GOO.emissive,
    emissiveIntensity: GOO.emissiveIntensity,
    transmission: GOO.transmission,
    thickness: GOO.thickness,
    ior: GOO.ior,
  });
  glowWithSlimeColour(material);

  const at = (r: number, degrees: number): THREE.Vector3 => {
    const t = THREE.MathUtils.degToRad(degrees);
    return centre
      .clone()
      .addScaledVector(uAx, Math.cos(t) * r)
      .addScaledVector(rAx, Math.sin(t) * r);
  };

  // Where each hole is, how deep it is and which way is outward.
  const holes = holeAngles.map((degrees, index) => {
    let rMin = Infinity;
    let rMax = 0;
    for (let r = holeR * 0.5; r < radius; r += radius * 0.004) {
      if (isOpen(r, degrees)) {
        rMin = Math.min(rMin, r);
        rMax = Math.max(rMax, r);
      }
    }
    const middle = at(Number.isFinite(rMin) ? (rMin + rMax) / 2 : holeR, degrees);

    // Drop onto the number plate to find the floor of the hole.
    raycaster.set(middle.clone().addScaledVector(normal, 0.02), into);
    const hit = plate ? raycaster.intersectObject(plate, false)[0] : undefined;
    const floor = hit ? hit.point.clone() : middle.clone().addScaledVector(normal, -0.0035);
    const depth = faceHeight - floor.clone().sub(centre).dot(normal);

    const outward = middle.clone().sub(centre);
    outward.addScaledVector(normal, -outward.dot(normal)).normalize();
    return {
      index,
      middle,
      floor,
      depth,
      outward,
      top: middle.clone().addScaledVector(normal, faceHeight),
    };
  });

  // Two or three drips, from holes in the lower half of the dial.
  const lower = holes.filter((h) => h.outward.dot(downhill) > GOO_SHAPE.lowerHalf);
  const shuffled = lower
    .map((h) => ({ h, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.h);
  const dripping = new Set(
    shuffled.slice(0, Math.min(GOO_SHAPE.maxDrips, lower.length)).map((h) => h.index),
  );

  // A drip comes with a smear. One or two more holes are just as full, wherever they are.
  const full = new Set(dripping);
  const others = holes
    .filter((h) => !full.has(h.index))
    .map((h) => ({ h, key: random() }))
    .sort((a, b) => a.key - b.key);
  for (const { h } of others.slice(0, 1 + Math.floor(random() * 2))) full.add(h.index);

  const goo = new THREE.Group();
  goo.name = 'goo';

  for (const hole of holes) {
    const isFull = full.has(hole.index);
    const fill = isFull
      ? lerp(GOO_SHAPE.fullFill.min, GOO_SHAPE.fullFill.max, random())
      : lerp(GOO_SHAPE.fill.min, GOO_SHAPE.fill.max, random());
    const seed = 100 + hole.index;
    const dome = isFull ? GOO_SHAPE.dome.full : GOO_SHAPE.dome.puddle;
    const place = (mesh: THREE.Mesh, name: string, position: THREE.Vector3) => {
      mesh.name = name;
      mesh.userData['hole'] = hole.index;
      mesh.position.copy(position);
      mesh.quaternion.copy(frame);
      goo.add(mesh);
    };

    const poolGeometry = buildPool({
      radius: holeRadius,
      fillHeight: fill * hole.depth,
      dome,
      seed,
    });
    colour(poolGeometry);
    place(
      new THREE.Mesh(poolGeometry, material),
      'goo-pool',
      hole.floor.clone().addScaledVector(normal, -0.0002),
    );

    if (!isFull) continue;

    // Full holes overflow downhill, and a dripping hole overflows the way its drip runs.
    const way = hole.outward.clone().multiplyScalar(0.6).addScaledVector(downhill, 0.4).normalize();
    const local = toLocal(way);
    const smearGeometry = buildSmear({
      radius: holeRadius,
      centreAngle: Math.atan2(local.z, local.x),
      arc: THREE.MathUtils.degToRad(lerp(60, 90, random())),
      height: lerp(0.0006, 0.0009, random()),
      innerDrop: Math.max(0, hole.depth * (1 - fill) - GOO_SHAPE.dome.full * 0.6),
      seed,
    });
    colour(smearGeometry);
    place(new THREE.Mesh(smearGeometry, material), 'goo-smear', hole.top);

    if (!dripping.has(hole.index)) continue;

    const length =
      holeRadius * 2 * lerp(GOO_SHAPE.dripLength.min, GOO_SHAPE.dripLength.max, random());
    const dripGeometry = buildDrip({ radius: holeRadius, length, direction: local, seed });
    colour(dripGeometry);
    place(
      new THREE.Mesh(dripGeometry, material),
      'goo-drip',
      hole.top.clone().addScaledVector(way, holeRadius),
    );
  }

  goo.traverse((o) => {
    o.castShadow = true;
  });
  return goo;
}
