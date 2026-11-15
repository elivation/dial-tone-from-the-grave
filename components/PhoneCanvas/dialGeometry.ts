import * as THREE from 'three';
import { STOP_ANGLE } from '@/lib/dial';

export type DialGeometry = {
  /** Centre of the finger wheel in world space. */
  centre: THREE.Vector3;
  /** Unit normal of the dial face, pointing up and out towards the user. */
  normal: THREE.Vector3;
  /** In-plane axis pointing to 12 o'clock on the dial. */
  uAx: THREE.Vector3;
  /** In-plane axis pointing to 3 o'clock on the dial. */
  rAx: THREE.Vector3;
  /** Largest vertex distance from the centre. */
  radius: number;
  /** Radius of the ring on which the finger holes sit. */
  holeR: number;
  /** Hole centres in degrees clockwise from 12 o'clock, in dial space. */
  holeAngles: number[];
};

type Mat3 = [[number, number, number], [number, number, number], [number, number, number]];

/** Read a matrix cell. Indices are always 0 to 2, so the fallback never applies. */
function at(m: number[][], i: number, j: number): number {
  return m[i]?.[j] ?? 0;
}

function set(m: number[][], i: number, j: number, value: number): void {
  const row = m[i];
  if (row) row[j] = value;
}

/**
 * Eigenvector of the smallest eigenvalue of a symmetric 3x3 matrix, by Jacobi
 * rotations. For a flat disc this is the disc normal.
 */
export function smallestEigenvector(input: Mat3): THREE.Vector3 {
  const a: number[][] = input.map((row) => [...row]);
  const v: number[][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
  ];
  const pairs: Array<[number, number]> = [
    [0, 1],
    [0, 2],
    [1, 2],
  ];

  for (let iteration = 0; iteration < 50; iteration++) {
    let p = 0;
    let q = 1;
    for (const [i, j] of pairs) {
      if (Math.abs(at(a, i, j)) > Math.abs(at(a, p, q))) {
        p = i;
        q = j;
      }
    }
    if (Math.abs(at(a, p, q)) < 1e-14) break;

    const theta = 0.5 * Math.atan2(2 * at(a, p, q), at(a, q, q) - at(a, p, p));
    const c = Math.cos(theta);
    const s = Math.sin(theta);

    for (let k = 0; k < 3; k++) {
      const akp = at(a, k, p);
      const akq = at(a, k, q);
      set(a, k, p, c * akp - s * akq);
      set(a, k, q, s * akp + c * akq);
    }
    for (let k = 0; k < 3; k++) {
      const apk = at(a, p, k);
      const aqk = at(a, q, k);
      set(a, p, k, c * apk - s * aqk);
      set(a, q, k, s * apk + c * aqk);
    }
    for (let k = 0; k < 3; k++) {
      const vkp = at(v, k, p);
      const vkq = at(v, k, q);
      set(v, k, p, c * vkp - s * vkq);
      set(v, k, q, s * vkp + c * vkq);
    }
  }

  let smallest = 0;
  for (let i = 1; i < 3; i++) {
    if (at(a, i, i) < at(a, smallest, smallest)) smallest = i;
  }
  return new THREE.Vector3(at(v, 0, smallest), at(v, 1, smallest), at(v, 2, smallest)).normalize();
}

/**
 * Centre, normal, in-plane axes and hole angles of the finger wheel mesh.
 *
 * Dial space is anchored to the finger stop mesh: the frame is turned about the
 * normal so the leading edge of the stop, the edge a finger hits, sits at
 * STOP_ANGLE. That is what lib/dial.ts means by the stop.
 */
export function computeDialGeometry(
  wheel: THREE.Mesh,
  phoneRotationY: number,
  stop: THREE.Mesh,
): DialGeometry {
  wheel.updateWorldMatrix(true, false);
  const position = wheel.geometry.getAttribute('position');
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < position.count; i += 3) {
    points.push(
      new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(wheel.matrixWorld),
    );
  }

  const centroid = new THREE.Vector3();
  points.forEach((p) => centroid.add(p));
  centroid.divideScalar(points.length);

  const cov: Mat3 = [
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ];
  for (const p of points) {
    const d = [p.x - centroid.x, p.y - centroid.y, p.z - centroid.z];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const row = cov[i];
        if (row) row[j] = (row[j] ?? 0) + (d[i] ?? 0) * (d[j] ?? 0);
      }
    }
  }

  const normal = smallestEigenvector(cov);
  if (normal.y < 0) normal.negate();

  // Provisional 12 o'clock: towards the back of the phone, flattened onto the dial plane.
  const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(
    new THREE.Vector3(0, 1, 0),
    phoneRotationY,
  );
  let uAx = back.sub(normal.clone().multiplyScalar(back.dot(normal))).normalize();
  let rAx = new THREE.Vector3().crossVectors(uAx, normal).normalize();

  // Vertices bunch around the hole edges, so the vertex mean is pulled off the axis.
  // The middle of the in-plane extent is the true centre of a round wheel.
  let uMin = Infinity;
  let uMax = -Infinity;
  let rMin = Infinity;
  let rMax = -Infinity;
  for (const p of points) {
    const d = p.clone().sub(centroid);
    uMin = Math.min(uMin, d.dot(uAx));
    uMax = Math.max(uMax, d.dot(uAx));
    rMin = Math.min(rMin, d.dot(rAx));
    rMax = Math.max(rMax, d.dot(rAx));
  }
  const centre = centroid
    .clone()
    .addScaledVector(uAx, (uMin + uMax) / 2)
    .addScaledVector(rAx, (rMin + rMax) / 2);

  // Turn the frame about the normal so the leading edge of the finger stop lands on STOP_ANGLE.
  const stopPosition = stop.geometry.getAttribute('position');
  const stopVectors: THREE.Vector3[] = [];
  const stopMiddle = new THREE.Vector3();
  for (let i = 0; i < stopPosition.count; i++) {
    const p = new THREE.Vector3()
      .fromBufferAttribute(stopPosition, i)
      .applyMatrix4(stop.matrixWorld)
      .sub(centre);
    stopVectors.push(p);
    stopMiddle.add(p);
  }
  stopMiddle.divideScalar(stopVectors.length);
  const angleOf = (v: THREE.Vector3) =>
    THREE.MathUtils.radToDeg(Math.atan2(v.dot(rAx), v.dot(uAx)));
  const middleAngle = angleOf(stopMiddle);
  let leadingOffset = 0;
  for (const v of stopVectors) {
    // Signed offset from the middle, wrapped to (-180, 180]. The most negative side faces the holes.
    const offset = ((((angleOf(v) - middleAngle) % 360) + 540) % 360) - 180;
    leadingOffset = Math.min(leadingOffset, offset);
  }
  const turn = THREE.MathUtils.degToRad(middleAngle + leadingOffset - STOP_ANGLE);
  uAx = uAx.clone().multiplyScalar(Math.cos(turn)).addScaledVector(rAx, Math.sin(turn)).normalize();
  rAx = new THREE.Vector3().crossVectors(uAx, normal).normalize();

  let radius = 0;
  for (const p of points) radius = Math.max(radius, p.distanceTo(centre));

  // A ray cast down the normal that misses the wheel has found a hole.
  const raycaster = new THREE.Raycaster();
  const down = normal.clone().negate();
  let best = { r: 0, misses: [] as number[] };
  for (let r = radius * 0.55; r < radius * 0.92; r += radius * 0.02) {
    const misses: number[] = [];
    for (let angle = 0; angle < 360; angle += 2) {
      const t = THREE.MathUtils.degToRad(angle);
      const origin = centre
        .clone()
        .addScaledVector(uAx, Math.cos(t) * r)
        .addScaledVector(rAx, Math.sin(t) * r)
        .addScaledVector(normal, 0.02);
      raycaster.set(origin, down);
      if (raycaster.intersectObject(wheel, false).length === 0) misses.push(angle);
    }
    if (misses.length > best.misses.length && misses.length < 160) best = { r, misses };
  }

  const runs: number[][] = [];
  let run: number[] = [];
  for (const angle of best.misses) {
    const previous = run[run.length - 1];
    if (previous !== undefined && angle - previous > 2) {
      runs.push(run);
      run = [];
    }
    run.push(angle);
  }
  if (run.length) runs.push(run);

  const first = runs[0];
  const last = runs[runs.length - 1];
  if (runs.length > 1 && first && last && first[0] === 0 && (last[last.length - 1] ?? 0) >= 358) {
    runs.pop();
    runs[0] = last.map((a) => a - 360).concat(first);
  }

  const holeAngles = runs.map((h) => ((h[0] ?? 0) + (h[h.length - 1] ?? 0)) / 2);
  return { centre, normal, uAx, rAx, radius, holeR: best.r, holeAngles };
}
