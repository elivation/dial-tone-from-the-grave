import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { angleInDial, downhillOf, radiusInDial } from './dialSpace';
import { colourGoo, slimeMaterial, worldVertices } from './goo';
import {
  buildBlob,
  buildRibbon,
  buildSpecks,
  buildStain,
  RIBBON_ACROSS,
  type Speck,
} from './gooShapes';
import { fbm, seededRandom } from './noise';
import { GOO_SHAPE } from './sceneConstants';

export type BodyGooInput = {
  dial: DialGeometry;
  /** The whole phone, to find the body surfaces the goo lies on. */
  object: THREE.Object3D;
  wheel: THREE.Mesh;
  stop: THREE.Mesh;
  /** The static group the pieces go into, built in world space. */
  group: THREE.Group;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const WORLD_DOWN = new THREE.Vector3(0, -1, 0);
/** One step of the run down the body, in metres. */
const RUN_STEP = 0.001;
/** Below this, the run counts as having reached the desk. */
const DESK_NEAR = 0.0015;
/** The puddle sits just above the soft contact shadow on the desk, which is 0.6 mm up. */
const PUDDLE_Y = 0.0007;

/** Meshes of the phone body that goo can run over. */
function bodySurfaces(object: THREE.Object3D): THREE.Mesh[] {
  const found: THREE.Mesh[] = [];
  object.traverse((o) => {
    if ((o as THREE.Mesh).isMesh && /Main_Body|Number_Plate|Base_Plate/.test(o.name))
      found.push(o as THREE.Mesh);
  });
  return found;
}

function faceNormal(hit: THREE.Intersection): THREE.Vector3 {
  const n = (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone();
  return n.transformDirection(hit.object.matrixWorld).normalize();
}

/** A rotation whose y is `up` and whose x lies along `along`, flattened onto the surface. */
function frameOn(up: THREE.Vector3, along: THREE.Vector3): THREE.Quaternion {
  const x = along.clone().addScaledVector(up, -along.dot(up)).normalize();
  const z = new THREE.Vector3().crossVectors(x, up).normalize();
  return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, up, z));
}

/**
 * Goo on the parts of the phone that never move: a smear on the finger stop where every finger
 * hits it, fine splatter round the dial, and one thick run from the bottom of the dial down the
 * front of the phone to a puddle on the desk. Returns where on the stop fingers hit.
 */
export function addBodyGoo({ dial, object, wheel, stop, group }: BodyGooInput): {
  stopEdge: THREE.Vector3;
} {
  const { centre, normal, uAx, rAx, radius, holeR } = dial;
  const random = seededRandom(23);
  const raycaster = new THREE.Raycaster();
  const into = normal.clone().negate();
  const heightOf = (v: THREE.Vector3) => v.clone().sub(centre).dot(normal);
  const material = slimeMaterial();
  const wheelTopAt = (point: THREE.Vector3): number | null => {
    raycaster.set(point.clone().addScaledVector(normal, 0.03), into);
    const hit = raycaster.intersectObject(wheel, false)[0];
    return hit ? heightOf(hit.point) : null;
  };
  const add = (mesh: THREE.Mesh, name: string) => {
    mesh.name = name;
    mesh.castShadow = name !== 'goo-specks';
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };

  // The finger stop. Fingers meet its leading edge, the side the holes come from, at the hole ring.
  const stopPoints = worldVertices(stop);
  const band = stopPoints.filter((v) => Math.abs(radiusInDial(v, dial) - holeR) < 0.0012);
  const angleOf = (v: THREE.Vector3) => angleInDial(v, dial);
  const leading = Math.min(...band.map(angleOf));
  const edgeBand = band.filter((v) => angleOf(v) < leading + 1.5);
  const stopEdge = edgeBand.reduce((best, v) => (heightOf(v) > heightOf(best) ? v : best));
  const turn = THREE.MathUtils.degToRad(leading);
  const clockwise = uAx
    .clone()
    .multiplyScalar(-Math.sin(turn))
    .addScaledVector(rAx, Math.cos(turn));
  const outward = stopEdge.clone().sub(centre);
  outward.addScaledVector(normal, -outward.dot(normal)).normalize();
  const stopGlob = (at: THREE.Vector3, size: number, stretch: number, seed: number) => {
    const geometry = buildBlob({ radius: size, height: size * 0.8, stretch, seed });
    colourGoo(geometry, (t) => 0.1 + 0.55 * (1 - t));
    const reach = size * 1.35 * stretch;
    // Sit on the stop, but never low enough to catch the wheel turning under it.
    let floor = -Infinity;
    for (let k = 0; k <= 8; k++) {
      const t = (k / 8) * Math.PI * 2;
      const sample =
        k === 8
          ? at
          : at
              .clone()
              .addScaledVector(outward, Math.cos(t) * reach)
              .addScaledVector(clockwise, Math.sin(t) * reach);
      const top = wheelTopAt(sample);
      if (top !== null) floor = Math.max(floor, top + 0.00025);
    }
    const base = Math.max(heightOf(at) - size * 0.45, floor);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(at).addScaledVector(normal, base - heightOf(at));
    mesh.quaternion.copy(frameOn(normal, outward));
    return add(mesh, 'goo-stop');
  };
  // Hanging a little off the leading face, so it reads as smeared on by fingers.
  stopGlob(stopEdge.clone().addScaledVector(clockwise, -0.0002), 0.0011, 1.7, 610);
  const tip = stopPoints.reduce((best, v) =>
    radiusInDial(v, dial) < radiusInDial(best, dial) ? v : best,
  );
  stopGlob(tip.clone(), 0.0006, 1.2, 611);

  // Fine splatter on the body and the number ring round the dial.
  const spots: Speck[] = [];
  for (let tries = 0; spots.length < GOO_SHAPE.specks && tries < GOO_SHAPE.specks * 6; tries++) {
    const degrees = random() * 360;
    const r = radius * lerp(1.06, 2.1, Math.sqrt(random()));
    const t = THREE.MathUtils.degToRad(degrees);
    const above = centre
      .clone()
      .addScaledVector(uAx, Math.cos(t) * r)
      .addScaledVector(rAx, Math.sin(t) * r)
      .addScaledVector(normal, 0.08);
    raycaster.set(above, into);
    const hit = raycaster
      .intersectObject(object, true)
      .find((h) => !/^goo/.test(h.object.name) && !/^goo/.test(h.object.parent?.name ?? ''));
    if (!hit || !/Main_Body|Number_Plate/.test(hit.object.name)) continue;
    if (radiusInDial(hit.point, dial) < radius * 1.06) continue;
    const n = faceNormal(hit);
    if (n.dot(above.clone().sub(hit.point)) < 0) n.negate();
    const away = hit.point.clone().sub(centre);
    spots.push({
      point: hit.point.clone().addScaledVector(n, 0.00001),
      normal: n,
      radius: 0.00012 + 0.0007 * Math.pow(random(), 2.5),
      tail: random() < 0.4 ? away.addScaledVector(n, -away.dot(n)).normalize() : null,
    });
  }
  const speckAge = spots.map(() => lerp(0.3, 1, random()));
  const specks = buildSpecks({ spots, seed: 9 });
  // Each speck is 21 vertices. Most have dried, a few are still wet.
  colourGoo(specks, (t, i) => Math.min(1, (speckAge[Math.floor(i / 21)] ?? 1) + 0.3 * (1 - t)));
  const speckMesh = add(new THREE.Mesh(specks, material), 'goo-specks');
  speckMesh.userData['count'] = spots.length;

  // The run: from the bottom edge of the dial, straight down the front of the phone under gravity.
  const surfaces = bodySurfaces(object);
  const downhill = downhillOf(normal);
  const start = centre.clone().addScaledVector(downhill, radius * 1.18);
  raycaster.set(start.clone().addScaledVector(normal, 0.03), into);
  const first = raycaster.intersectObjects(surfaces, false)[0];
  if (!first) return { stopEdge };
  const path: Array<{ point: THREE.Vector3; normal: THREE.Vector3 }> = [];
  let point = first.point.clone();
  let n = faceNormal(first);
  if (n.dot(normal) < 0) n.negate();
  path.push({ point: point.clone(), normal: n.clone() });
  for (let step = 0; step < 300 && point.y > DESK_NEAR; step++) {
    const fall = WORLD_DOWN.clone().addScaledVector(n, -WORLD_DOWN.dot(n));
    if (fall.length() < 0.2) break;
    fall.normalize();
    // It wanders a little from side to side as it finds its way down, but always goes down.
    const sideways = new THREE.Vector3().crossVectors(n, fall).normalize();
    fall.addScaledVector(sideways, 0.35 * (fbm(step * 0.11, 4.7, 3) - 0.5)).normalize();
    const next = point.clone().addScaledVector(fall, RUN_STEP);
    raycaster.set(next.clone().addScaledVector(n, 0.004), n.clone().negate());
    const hit = raycaster.intersectObjects(surfaces, false)[0];
    if (!hit || hit.distance > 0.008) break;
    const hn = faceNormal(hit);
    if (hn.dot(n) < 0) hn.negate();
    if (hit.point.y >= point.y - 1e-5) break;
    point = hit.point.clone();
    n = hn;
    path.push({ point: point.clone(), normal: n.clone() });
  }
  if (path.length < 3) return { stopEdge };

  // Draped flat on the body: every point across the run is dropped onto the surface under it.
  const drape = (p: THREE.Vector3, along: THREE.Vector3) => {
    raycaster.set(p.clone().addScaledVector(along, 0.003), along.clone().negate());
    const hit = raycaster.intersectObjects(surfaces, false)[0];
    return hit && hit.distance < 0.006 ? hit.point.clone() : null;
  };
  // It collects where the body bends, at the bottom edge, and sometimes once on the way down.
  const bend = path.map((p, i) => {
    const before = (path[Math.max(0, i - 2)] as typeof p).normal;
    const after = (path[Math.min(path.length - 1, i + 2)] as typeof p).normal;
    return before.angleTo(after);
  });
  const sharpest = bend.indexOf(Math.max(...bend.slice(2, -2)));
  const bulges = [sharpest / (path.length - 1), 0.82];
  if (random() < 0.6) bulges.push(lerp(0.45, 0.65, random()));
  bulges.sort((a, b) => a - b);
  const gather = (s: number) =>
    bulges.reduce((sum, b) => sum + Math.exp(-(((s - b) / 0.085) ** 2)), 0);
  // Wide and thin, a film more than a rope, gathering softly where it slows.
  const widthAt = (s: number) =>
    (0.0058 - 0.0016 * s) *
    (0.9 + 0.2 * fbm(s * 7, 3.1, 3)) *
    (1 + 0.7 * gather(s)) *
    Math.min(1, 0.5 + s * 6);
  const heightAt = (s: number) => 0.00014 * (1 + 0.8 * gather(s)) * Math.min(1, 0.45 + s * 5);
  const ribbon = buildRibbon({ path, widthAt, heightAt, seed: 31, drape });
  // Fresh down the middle, crusted dark along both edges, however thin the run is there.
  const acrossOf = (index: number) =>
    Math.abs(((index % (RIBBON_ACROSS + 1)) / RIBBON_ACROSS) * 2 - 1);
  colourGoo(ribbon, (_, index) => 0.12 + 0.85 * acrossOf(index) ** 2);
  const run = add(new THREE.Mesh(ribbon, material), 'goo-run');
  run.userData['part'] = 'ribbon';
  run.userData['path'] = path.map((p) => p.point.clone());
  run.userData['normals'] = path.map((p) => p.normal.clone());
  run.userData['across'] = RIBBON_ACROSS;
  run.userData['widths'] = path.map((_, i) => widthAt(i / (path.length - 1)));
  run.userData['bulges'] = bulges;

  // Off the bottom edge it hangs as a sheet, widening as it reaches the desk.
  const last = path[path.length - 1] as { point: THREE.Vector3; normal: THREE.Vector3 };
  const level = last.normal.clone().setY(0);
  const out = level.lengthSq() > 1e-6 ? level.normalize() : new THREE.Vector3(0, 0, 1);
  const hang: Array<{ point: THREE.Vector3; normal: THREE.Vector3 }> = [];
  for (let y = last.point.y; y > PUDDLE_Y + 0.0003; y -= 0.0005) {
    hang.push({
      point: new THREE.Vector3(last.point.x, y, last.point.z).addScaledVector(out, 0.0002),
      normal: out.clone(),
    });
  }
  const startWidth = widthAt(1);
  const curtainWidth = (s: number) =>
    startWidth * (1 + 1.1 * s * s) * (0.92 + 0.16 * fbm(s * 5, 8.3, 2));
  if (hang.length >= 3) {
    const sheet = buildRibbon({
      path: hang,
      widthAt: curtainWidth,
      heightAt: (s) => 0.00026 + 0.0001 * s,
      seed: 37,
    });
    colourGoo(sheet, (_, index) => 0.1 + 0.85 * acrossOf(index) ** 2);
    const curtain = add(new THREE.Mesh(sheet, material), 'goo-run');
    curtain.userData['part'] = 'curtain';
    curtain.userData['widths'] = hang.map((_, i) => curtainWidth(i / (hang.length - 1)));
  }

  // The puddle it has made on the desk, spreading out in front.
  const foot = (hang.at(-1) ?? last).point;
  const puddle = buildStain({
    size: 0.005,
    run: 0,
    direction: { x: 1, z: 0 },
    height: 0.00045,
    seed: 51,
  });
  colourGoo(puddle, (t) => Math.min(1, 0.1 + 1.6 * (1 - t / 0.5) ** 2));
  const puddleMesh = new THREE.Mesh(puddle, material);
  puddleMesh.position.set(foot.x, PUDDLE_Y, foot.z).addScaledVector(out, 0.0022);
  puddleMesh.rotation.y = random() * Math.PI * 2;
  add(puddleMesh, 'goo-puddle');
  return { stopEdge };
}
