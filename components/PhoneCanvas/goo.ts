import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { downhillOf } from './dialSpace';
import { findDripStart } from './dripSites';
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
/** A drip sinks this far into the plate, so no sliver of light shows under it. */
const DRIP_SINK = 0.00005;

/** Gives each slime mesh its colour, from the thickness its shape recorded. */
function colour(geometry: THREE.BufferGeometry): void {
  const thickness = geometry.getAttribute('thickness');
  paintGoo(geometry, (i) => thickness.getX(i));
}

export type GooPieces = {
  /** Pools in the holes and smears over their rims. These ride on the wheel, so the caller attaches them to it. */
  pools: THREE.Group;
  /** Drips on the number plate. Gravity pulls them, not the wheel, so the caller attaches them to the static phone body. */
  drips: THREE.Group;
};
/**
 * Wet green slime in the finger holes. Every hole holds a column of it, filled to a different
 * level with an uneven outline. The fullest are smeared over part of the rim.
 *
 * Two or three holes on the lower half of the dial also drip. A drip is not part of the wheel: it
 * lies on the fixed number plate just outside its hole's rest position, runs downhill, and stays
 * out of the path of every hole, so it never moves or crosses a hole as the wheel turns.
 *
 * Built in world space from the dial's own geometry. The caller attaches each group.
 */
export function buildGoo({ dial, plate }: GooInput): GooPieces {
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
  const downhill = downhillOf(normal);
  const plateAt = (point: THREE.Vector3): THREE.Vector3 | undefined => {
    if (!plate) return undefined;
    raycaster.set(point.clone().addScaledVector(normal, 0.02), into);
    return raycaster.intersectObject(plate, false)[0]?.point.clone();
  };

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

  // Two or three drips, from holes in the lower half of the dial that have a clear place for one.
  const lowerHoles = holes.filter((h) => h.outward.dot(downhill) > GOO_SHAPE.lowerHalf);
  const sites = lowerHoles.flatMap((hole) => {
    const length =
      holeRadius * 2 * lerp(GOO_SHAPE.dripLength.min, GOO_SHAPE.dripLength.max, random());
    const start = findDripStart({
      dial,
      holeMiddle: hole.middle,
      direction: downhill,
      length,
      holeRadius,
    });
    const onPlate = start ? plateAt(start) : undefined;
    return start && onPlate ? [{ hole, length, onPlate }] : [];
  });
  const chosen = sites
    .map((site) => ({ site, key: random() }))
    .sort((a, b) => a.key - b.key)
    .slice(0, GOO_SHAPE.maxDrips)
    .map((x) => x.site);
  const dripping = new Map(chosen.map((site) => [site.hole.index, site]));

  // A drip comes with a smear. One or two more holes are just as full, wherever they are.
  const full = new Set(dripping.keys());
  const others = holes
    .filter((h) => !full.has(h.index))
    .map((h) => ({ h, key: random() }))
    .sort((a, b) => a.key - b.key);
  for (const { h } of others.slice(0, 1 + Math.floor(random() * 2))) full.add(h.index);

  const goo = new THREE.Group();
  goo.name = 'goo';
  const drips = new THREE.Group();
  drips.name = 'goo-drips';

  for (const hole of holes) {
    const isFull = full.has(hole.index);
    const fill = isFull
      ? lerp(GOO_SHAPE.fullFill.min, GOO_SHAPE.fullFill.max, random())
      : lerp(GOO_SHAPE.fill.min, GOO_SHAPE.fill.max, random());
    const seed = 100 + hole.index;
    const dome = isFull ? GOO_SHAPE.dome.full : GOO_SHAPE.dome.puddle;
    const place = (
      mesh: THREE.Mesh,
      name: string,
      position: THREE.Vector3,
      parent: THREE.Group = goo,
    ) => {
      mesh.name = name;
      mesh.userData['hole'] = hole.index;
      mesh.position.copy(position);
      mesh.quaternion.copy(frame);
      parent.add(mesh);
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

    const drip = dripping.get(hole.index);
    if (!drip) continue;
    // The drip hugs the plate, which is not flat, so each ring of it is raised to meet the plate.
    const lift = (along: number) => {
      const hit = plateAt(drip.onPlate.clone().addScaledVector(downhill, along * drip.length));
      return (hit ? hit.sub(drip.onPlate).dot(normal) : 0) - DRIP_SINK;
    };
    const dripGeometry = buildDrip({
      radius: holeRadius,
      length: drip.length,
      direction: toLocal(downhill),
      lift,
      seed,
    });
    colour(dripGeometry);
    place(new THREE.Mesh(dripGeometry, material), 'goo-drip', drip.onPlate, drips);
  }
  for (const group of [goo, drips]) {
    group.traverse((o) => {
      o.castShadow = true;
    });
  }
  return { pools: goo, drips };
}
