import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { angleInDial, downhillOf, radiusInDial } from './dialSpace';
import { glowWithSlimeColour, paintGoo } from './gooColour';
import { buildPool, buildStain } from './gooShapes';
import { seededRandom } from './noise';
import { GOO, GOO_SHAPE } from './sceneConstants';

export type GooInput = {
  dial: DialGeometry;
  /** The finger wheel. Its top surface round each hole sets how full a pool may be. */
  wheel: THREE.Mesh;
  /** The number plate under the wheel. Pools stand on it, at the bottom of each hole, and stains lie on it. */
  plate: THREE.Mesh | undefined;
  /** The card in the middle of the dial. No stain goes under it. */
  card: THREE.Mesh | undefined;
};

export type GooPieces = {
  /** Pools in the holes. These ride on the wheel, so the caller attaches them to it. */
  pools: THREE.Group;
  /** Old leaks on the number plate. They never move, so the caller attaches them to the static phone body. */
  stains: THREE.Group;
};

/** Fraction of a hole's open radius a pool may fill, so its edge never touches the wheel. */
const HOLE_FILL = 0.97;
const CIRCLE_SAMPLES = 72;
/** Grid spacing, in metres, used to find the middle of each hole's opening. */
const GRID = 0.0002;

export type HoleOpening = {
  /** Hole angle as found by the dial geometry, in degrees clockwise from 12 o'clock. */
  degrees: number;
  /** Middle of the opening in the dial plane: x towards 12 o'clock, y towards 3 o'clock, metres. */
  x: number;
  y: number;
  /** Radius of the largest circle round the middle that is open all the way round, metres. */
  radius: number;
};

const openingsCache = new WeakMap<DialGeometry, HoleOpening[]>();

const polar = (x: number, y: number) => ({
  r: Math.hypot(x, y),
  degrees: ((THREE.MathUtils.radToDeg(Math.atan2(y, x)) % 360) + 360) % 360,
});

/**
 * Each finger hole's opening, measured from the wheel itself: the centroid of the open area round
 * the hole, and the largest circle about it that is open all the way round. Read from the hole
 * bitmap, so it follows the real model rather than an estimate.
 */
export function holeOpenings(dial: DialGeometry): HoleOpening[] {
  const cached = openingsCache.get(dial);
  if (cached) return cached;
  const isOpenAt = (x: number, y: number) => {
    const p = polar(x, y);
    return dial.isOpen(p.r, p.degrees);
  };
  const openings = dial.holeAngles.map((degrees) => {
    const a = THREE.MathUtils.degToRad(degrees);
    // Rough middle on the hole's ring, then the centroid of the connected open area near it.
    let rMin = Infinity;
    let rMax = 0;
    for (let r = dial.holeR * 0.5; r < dial.radius; r += dial.radius / 2000) {
      if (dial.isOpen(r, degrees)) {
        rMin = Math.min(rMin, r);
        rMax = Math.max(rMax, r);
      }
    }
    const rough = Number.isFinite(rMin) ? (rMin + rMax) / 2 : dial.holeR;
    const span = Number.isFinite(rMin) ? (rMax - rMin) / 2 : dial.holeR * 0.2;
    const cx = Math.cos(a) * rough;
    const cy = Math.sin(a) * rough;
    let sx = 0;
    let sy = 0;
    let n = 0;
    const reach = Math.ceil((span * 1.05) / GRID);
    for (let i = -reach; i <= reach; i++) {
      for (let j = -reach; j <= reach; j++) {
        const dx = i * GRID;
        const dy = j * GRID;
        // Only inside the radial span, so a merged neighbour or the gap past the stop is not counted.
        if (Math.hypot(dx, dy) > span * 1.05) continue;
        if (isOpenAt(cx + dx, cy + dy)) {
          sx += cx + dx;
          sy += cy + dy;
          n++;
        }
      }
    }
    const x = n ? sx / n : cx;
    const y = n ? sy / n : cy;
    const openCircle = (r: number) => {
      for (let k = 0; k < CIRCLE_SAMPLES; k++) {
        const t = (k / CIRCLE_SAMPLES) * Math.PI * 2;
        if (!isOpenAt(x + Math.cos(t) * r, y + Math.sin(t) * r)) return false;
      }
      return true;
    };
    let lo = 0;
    let hi = span * 1.2;
    for (let i = 0; i < 24; i++) {
      const mid = (lo + hi) / 2;
      if (openCircle(mid)) lo = mid;
      else hi = mid;
    }
    return { degrees, x, y, radius: lo };
  });
  openingsCache.set(dial, openings);
  return openings;
}

/** Radius a pool may fill in the narrowest finger hole, in metres. */
export function holeRadiusOf(dial: DialGeometry): number {
  return Math.min(...holeOpenings(dial).map((o) => o.radius)) * HOLE_FILL;
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** Pools sit a hair into the plate, so no sliver of light shows under them. */
const POOL_SINK = 0.00003;
/** Allows for the top surface dipping a little between the points where the rim is read. */
const RIM_MARGIN = 0.00005;
/** Where the rim is read: this many hole radii out from the hole's middle, at this many points. */
const RIM_REACH = 1.12;
const RIM_SAMPLES = 24;
/** Stains keep this far from the card and from the wheel's edge. */
const STAIN_CLEAR = { card: 0.0012, edge: 0.92 };
const STAIN_TRIES = 6;

function colour(geometry: THREE.BufferGeometry): void {
  const thickness = geometry.getAttribute('thickness');
  paintGoo(geometry, (i) => thickness.getX(i));
}

function slimeMaterial(): THREE.MeshPhysicalMaterial {
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
  return material;
}

function worldVertices(mesh: THREE.Mesh): THREE.Vector3[] {
  mesh.updateWorldMatrix(true, false);
  const position = mesh.geometry.getAttribute('position');
  return Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
  );
}

/**
 * Wet green slime. Every finger hole holds a pool, recessed below the wheel's top surface: a few
 * are about 80 percent full, a couple are a film on the floor, the rest are somewhere between.
 * Under the ring of holes, old leaks have stained the fixed number plate. They show through the
 * clear wheel and through any empty hole that passes over them.
 *
 * Built in world space from the dial's own geometry. The caller attaches each group: the pools to
 * the wheel, the stains to the phone body.
 */
export function buildGoo({ dial, wheel, plate, card }: GooInput): GooPieces {
  const { centre, normal, uAx, rAx, radius, holeR, holeAngles } = dial;
  const holeRadius = holeRadiusOf(dial);
  const random = seededRandom(11);
  const raycaster = new THREE.Raycaster();
  const into = normal.clone().negate();
  // Pieces are built flat, with x to 3 o'clock, y out of the dial and z to 6 o'clock.
  const frame = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(rAx, normal, uAx.clone().negate()),
  );
  const toLocal = (v: THREE.Vector3) => ({ x: v.dot(rAx), z: -v.dot(uAx) });
  const heightOf = (v: THREE.Vector3) => v.clone().sub(centre).dot(normal);
  const inPlane = (v: THREE.Vector3) => v.clone().addScaledVector(normal, -v.dot(normal));
  const downhill = downhillOf(normal);
  const at = (r: number, degrees: number): THREE.Vector3 => {
    const t = THREE.MathUtils.degToRad(degrees);
    return centre
      .clone()
      .addScaledVector(uAx, Math.cos(t) * r)
      .addScaledVector(rAx, Math.sin(t) * r);
  };
  const plateAt = (point: THREE.Vector3): THREE.Vector3 | undefined => {
    if (!plate) return undefined;
    raycaster.set(point.clone().addScaledVector(normal, 0.02), into);
    return raycaster.intersectObject(plate, false)[0]?.point.clone();
  };
  const pools = new THREE.Group();
  pools.name = 'goo';
  const stains = new THREE.Group();
  stains.name = 'goo-stains';
  const place = (group: THREE.Group, mesh: THREE.Mesh, name: string, position: THREE.Vector3) => {
    mesh.name = name;
    mesh.position.copy(position);
    mesh.quaternion.copy(frame);
    mesh.castShadow = name === 'goo-pool';
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // The lowest point of the wheel's top surface just outside a hole, found by casting rays straight
  // down at the wheel on a ring round the hole. The first hit is the top face.
  const rimHeight = (middle: THREE.Vector3, open: number): number => {
    let lowest = Infinity;
    for (let k = 0; k < RIM_SAMPLES; k++) {
      const t = (k / RIM_SAMPLES) * Math.PI * 2;
      const point = middle
        .clone()
        .addScaledVector(uAx, Math.cos(t) * open * RIM_REACH)
        .addScaledVector(rAx, Math.sin(t) * open * RIM_REACH)
        .addScaledVector(normal, 0.02);
      raycaster.set(point, into);
      const hit = raycaster.intersectObject(wheel, false)[0];
      if (hit) lowest = Math.min(lowest, heightOf(hit.point));
    }
    return (Number.isFinite(lowest) ? lowest : dial.faceHeight) - RIM_MARGIN;
  };

  // Where each hole is, where its floor is, and how high its pool may go.
  const openings = holeOpenings(dial);
  const holes = holeAngles.map((_, index) => {
    const opening = openings[index] as HoleOpening;
    const middle = centre.clone().addScaledVector(uAx, opening.x).addScaledVector(rAx, opening.y);
    const floor = (
      plateAt(middle) ?? middle.clone().addScaledVector(normal, -0.003)
    ).addScaledVector(normal, -POOL_SINK);
    return {
      index,
      floor,
      rim: rimHeight(middle, opening.radius),
      poolRadius: opening.radius * HOLE_FILL,
    };
  });

  // A few holes are nearly full, a couple hold a film, the rest are part full.
  const order = holes
    .map((hole) => ({ hole, key: random() }))
    .sort((a, b) => a.key - b.key)
    .map((x) => x.hole);
  const material = slimeMaterial();
  order.forEach((hole, rank) => {
    const floorHeight = heightOf(hole.floor);
    const highest = hole.rim - GOO_SHAPE.minClearance - floorHeight;
    let top: number;
    if (rank < GOO_SHAPE.fullHoles) {
      const gap = lerp(GOO_SHAPE.fullGap.min + RIM_MARGIN, GOO_SHAPE.fullGap.max, random());
      top = hole.rim - gap - floorHeight;
    } else if (rank < GOO_SHAPE.fullHoles + GOO_SHAPE.filmHoles) {
      top = lerp(GOO_SHAPE.film.min, GOO_SHAPE.film.max, random()) + POOL_SINK;
    } else {
      top = highest * lerp(GOO_SHAPE.partFill.min, GOO_SHAPE.partFill.max, random());
    }
    const geometry = buildPool({
      radius: hole.poolRadius,
      top: Math.min(top, highest),
      seed: 100 + hole.index,
    });
    colour(geometry);
    const mesh = place(pools, new THREE.Mesh(geometry, material), 'goo-pool', hole.floor);
    mesh.userData['hole'] = hole.index;
  });

  // Old leaks on the plate, spread round under the ring of holes.
  const stainMaterial = slimeMaterial();
  // Drawn just over the plate. The offset stops the two flickering against each other.
  stainMaterial.polygonOffset = true;
  stainMaterial.polygonOffsetFactor = -1;
  stainMaterial.polygonOffsetUnits = -4;
  const cardRadius = card
    ? Math.max(...worldVertices(card).map((v) => radiusInDial(v, dial)))
    : holeR * 0.6;
  const count =
    GOO_SHAPE.stains.min + Math.floor(random() * (GOO_SHAPE.stains.max - GOO_SHAPE.stains.min + 1));
  const offset = random() * 360;
  const spots = Array.from({ length: count }, (_, i) => {
    const degrees = offset + (i * 360) / count + (random() - 0.5) * 24;
    const r = holeR + (random() - 0.5) * 0.7 * holeRadius;
    const spot = at(r, degrees);
    const outward = inPlane(spot.clone().sub(centre)).normalize();
    return { spot, lower: outward.dot(downhill), key: random() };
  });
  // Two or three run downhill, from spots on the lower half where running away from the card is possible.
  const runners = new Set(
    spots
      .filter((s) => s.lower > 0.3)
      .sort((a, b) => a.key - b.key)
      .slice(0, 2 + Math.floor(random() * 2)),
  );
  const fits = (mesh: THREE.Mesh) =>
    worldVertices(mesh).every((v) => {
      const r = radiusInDial(v, dial);
      return r > cardRadius + STAIN_CLEAR.card && r < radius * STAIN_CLEAR.edge;
    });
  spots.forEach((s, i) => {
    const onPlate = plateAt(s.spot);
    if (!onPlate) return;
    const run = runners.has(s) ? lerp(0.85, 1, random()) : lerp(0, 0.08, random());
    let size = lerp(GOO_SHAPE.stainSize.min, GOO_SHAPE.stainSize.max, random());
    for (let attempt = 0; attempt < STAIN_TRIES; attempt++, size *= 0.85) {
      const geometry = buildStain({ size, run, direction: toLocal(downhill), seed: 300 + i });
      colour(geometry);
      const mesh = new THREE.Mesh(geometry, stainMaterial);
      mesh.position.copy(onPlate);
      mesh.quaternion.copy(frame);
      if (!fits(mesh)) {
        geometry.dispose();
        continue;
      }
      place(stains, mesh, 'goo-stain', onPlate);
      mesh.userData['angle'] = angleInDial(onPlate, dial);
      return;
    }
  });

  return { pools, stains };
}
