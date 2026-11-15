import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { colourGoo, type HoleOpening } from './goo';
import type { FilmPlan } from './gooDecals';
import { buildRibbon } from './gooShapes';

export type SpillInput = {
  dial: DialGeometry;
  wheel: THREE.Mesh;
  /** The wheel's goo group, still in world space. */
  group: THREE.Group;
  material: THREE.MeshPhysicalMaterial;
  openings: HoleOpening[];
  film: FilmPlan;
  poolTops: Map<number, number>;
  poolRadii: Map<number, number>;
};

/** Longest step between two points of a spill, so it bends smoothly over the lip. */
const STEP = 0.0005;
const WALL_SEARCH_STEP = 0.00005;
/** How far the goo sits in from the wall and above the surfaces it covers. */
const ON_WALL = 0.00008;

type Mark = { point: THREE.Vector3; normal: THREE.Vector3 };

/** Splits a run of points so no step is longer than STEP, blending the normals between them. */
function subdivide(marks: Mark[]): Mark[] {
  const out: Mark[] = [];
  marks.forEach((mark, i) => {
    if (i === 0) {
      out.push(mark);
      return;
    }
    const from = marks[i - 1] as Mark;
    const steps = Math.max(1, Math.ceil(from.point.distanceTo(mark.point) / STEP));
    for (let k = 1; k <= steps; k++) {
      const t = k / steps;
      out.push({
        point: from.point.clone().lerp(mark.point, t),
        normal: from.normal.clone().lerp(mark.normal, t).normalize(),
      });
    }
  });
  return out;
}

/**
 * Goo spilling out of an overflowing hole: a tongue of slime that leaves the pool, climbs the
 * hole's wall, bends over the lip and runs onto the wheel face, where it joins the smear painted
 * there. One per overflowing hole, towards its largest smear. Added to the wheel's goo group.
 */
export function addSpills({
  dial,
  wheel,
  group,
  material,
  openings,
  film,
  poolTops,
  poolRadii,
}: SpillInput): void {
  const { centre, normal, uAx, rAx, isOpen } = dial;
  const raycaster = new THREE.Raycaster();
  const into = normal.clone().negate();
  const heightOf = (v: THREE.Vector3) => v.clone().sub(centre).dot(normal);
  const toWorld = (x: number, y: number) =>
    centre.clone().addScaledVector(uAx, x).addScaledVector(rAx, y);
  const openAt = (x: number, y: number) => {
    const r = Math.hypot(x, y);
    const degrees = ((((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360;
    return isOpen(r, degrees);
  };
  const faceAt = (p: THREE.Vector3): Mark | null => {
    raycaster.set(p.clone().addScaledVector(normal, 0.02), into);
    const hit = raycaster.intersectObject(wheel, false)[0];
    if (!hit) return null;
    return { point: hit.point.clone(), normal: normal.clone() };
  };

  film.overflowHoles.forEach((hole, n) => {
    const opening = openings[hole];
    const top = poolTops.get(hole);
    const poolRadius = poolRadii.get(hole);
    if (!opening || top === undefined || poolRadius === undefined) return;
    const smears = film.strokes.filter(
      (s): s is Extract<FilmPlan['strokes'][number], { kind: 'smear' }> =>
        s.kind === 'smear' &&
        Math.hypot(s.at.x - opening.x, s.at.y - opening.y) < opening.radius * 1.7,
    );
    const target = smears.reduce<(typeof smears)[number] | null>(
      (best, s) => (best && best.size * best.stretch >= s.size * s.stretch ? best : s),
      null,
    );
    if (!target) return;
    const dx = target.at.x - opening.x;
    const dy = target.at.y - opening.y;
    const length = Math.hypot(dx, dy);
    const dir = { x: dx / length, y: dy / length };
    const dirWorld = uAx.clone().multiplyScalar(dir.x).addScaledVector(rAx, dir.y).normalize();
    const along = (d: number) => toWorld(opening.x + dir.x * d, opening.y + dir.y * d);
    const lift = (p: THREE.Vector3, h: number) =>
      p.clone().addScaledVector(normal, h - heightOf(p));

    // Where the wall of the hole is, this way.
    let wall = 0;
    while (
      wall < opening.radius * 2.5 &&
      openAt(opening.x + dir.x * wall, opening.y + dir.y * wall)
    ) {
      wall += WALL_SEARCH_STEP;
    }
    const lip = faceAt(along(wall + 0.0003));
    const end = faceAt(along(Math.max(length, wall + 0.0012)));
    if (!lip || !end) return;
    const lipHeight = heightOf(lip.point);
    const back = dirWorld.clone().negate();

    const marks: Mark[] = [
      // On the pool, a little in from its edge.
      { point: lift(along(poolRadius * 0.45), top - 0.00025), normal: normal.clone() },
      {
        point: lift(along(Math.min(poolRadius * 0.92, wall - ON_WALL)), top - 0.00005),
        normal: normal.clone(),
      },
      // Up the wall of the hole, facing back into it.
      { point: lift(along(wall - ON_WALL), top), normal: back.clone() },
      { point: lift(along(wall - ON_WALL), lipHeight - 0.00015), normal: back.clone() },
      // Over the lip and onto the face.
      { point: lip.point.clone(), normal: normal.clone().add(back).normalize() },
    ];
    for (let d = wall + 0.0008; d < Math.max(length, wall + 0.0012); d += 0.0006) {
      const face = faceAt(along(d));
      if (face) marks.push(face);
    }
    marks.push(end);
    const path = subdivide(marks);

    const ribbon = buildRibbon({
      path,
      // Wide where it leaves the pool, pinched over the lip, spreading again into the smear.
      widthAt: (s) =>
        target.size * (1.6 - 1.4 * Math.sin(Math.PI * Math.min(1, s * 1.4)) * 0.45 + 0.5 * s),
      heightAt: (s) => 0.00022 + 0.00012 * Math.sin(Math.PI * s),
      seed: 700 + n,
    });
    // Fresh where it is moving, drying at its edges.
    colourGoo(ribbon, (t) => 0.55 * (1 - t) ** 2);
    const mesh = new THREE.Mesh(ribbon, material);
    mesh.name = 'goo-spill';
    mesh.userData['hole'] = hole;
    mesh.userData['path'] = path.map((m) => m.point.clone());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
  });
}
