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
  /** Average angular width of a hole, in degrees. */
  holeWidth: number;
  /**
   * True when nothing of the wheel lies at this spot of the dial, looking straight down the normal.
   * `r` is the distance from the centre in metres, `degrees` is clockwise from 12 o'clock in dial space.
   */
  isOpen: (r: number, degrees: number) => boolean;
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

const GRID_SIZE = 768;
/** Rays were sampled this many degrees apart, so each hole is this much wider than its samples show. */
const ANGLE_STEP = 2;

/**
 * Draws the wheel's triangles, projected flat onto the dial plane, into a bitmap.
 * A ray cast straight down the normal hits the wheel exactly where a projected triangle
 * covers the spot, so this answers the same question as raycasting, thousands of times faster.
 */
function coverWheel(
  wheel: THREE.Mesh,
  centre: THREE.Vector3,
  uAx: THREE.Vector3,
  rAx: THREE.Vector3,
  extent: number,
): (du: number, dr: number) => boolean {
  const position = wheel.geometry.getAttribute('position');
  const scale = GRID_SIZE / (2 * extent);
  const px = new Float32Array(position.count);
  const py = new Float32Array(position.count);
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(wheel.matrixWorld).sub(centre);
    px[i] = (v.dot(rAx) + extent) * scale;
    py[i] = (v.dot(uAx) + extent) * scale;
  }

  const covered = new Uint8Array(GRID_SIZE * GRID_SIZE);
  const index = wheel.geometry.getIndex();
  const triangleCount = (index ? index.count : position.count) / 3;
  const corner = (t: number, k: number) => (index ? index.getX(t * 3 + k) : t * 3 + k);

  for (let t = 0; t < triangleCount; t++) {
    const a = corner(t, 0);
    const b = corner(t, 1);
    const c = corner(t, 2);
    const ax = px[a] ?? 0;
    const ay = py[a] ?? 0;
    const bx = px[b] ?? 0;
    const by = py[b] ?? 0;
    const cx = px[c] ?? 0;
    const cy = py[c] ?? 0;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    if (Math.abs(area) < 1e-9) continue; // edge-on faces cover nothing

    const sign = area > 0 ? 1 : -1;
    const lengths = [
      Math.hypot(cx - bx, cy - by),
      Math.hypot(ax - cx, ay - cy),
      Math.hypot(bx - ax, by - ay),
    ];
    const x0 = Math.max(0, Math.floor(Math.min(ax, bx, cx) - 1));
    const x1 = Math.min(GRID_SIZE - 1, Math.ceil(Math.max(ax, bx, cx) + 1));
    const y0 = Math.max(0, Math.floor(Math.min(ay, by, cy) - 1));
    const y1 = Math.min(GRID_SIZE - 1, Math.ceil(Math.max(ay, by, cy) + 1));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        const qx = x + 0.5;
        const qy = y + 0.5;
        // Signed distance from each edge, in pixels. Half a pixel of slack stops cracks between triangles.
        const d0 = (sign * ((cx - bx) * (qy - by) - (cy - by) * (qx - bx))) / (lengths[0] || 1);
        const d1 = (sign * ((ax - cx) * (qy - cy) - (ay - cy) * (qx - cx))) / (lengths[1] || 1);
        const d2 = (sign * ((bx - ax) * (qy - ay) - (by - ay) * (qx - ax))) / (lengths[2] || 1);
        if (d0 >= -0.5 && d1 >= -0.5 && d2 >= -0.5) covered[y * GRID_SIZE + x] = 1;
      }
    }
  }

  return (du: number, dr: number) => {
    const x = Math.floor((dr + extent) * scale);
    const y = Math.floor((du + extent) * scale);
    if (x < 0 || y < 0 || x >= GRID_SIZE || y >= GRID_SIZE) return false;
    return covered[y * GRID_SIZE + x] === 1;
  };
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

  // A spot where nothing of the wheel lies, looking down the normal, is a hole.
  const wheelAt = coverWheel(wheel, centre, uAx, rAx, radius * 1.05);
  const isOpen = (r: number, degrees: number): boolean => {
    const t = THREE.MathUtils.degToRad(degrees);
    return !wheelAt(Math.cos(t) * r, Math.sin(t) * r);
  };
  let best = { r: 0, misses: [] as number[] };
  for (let r = radius * 0.55; r < radius * 0.92; r += radius * 0.02) {
    const misses: number[] = [];
    for (let angle = 0; angle < 360; angle += ANGLE_STEP) {
      if (isOpen(r, angle)) misses.push(angle);
    }
    if (misses.length > best.misses.length && misses.length < 160) best = { r, misses };
  }

  const runs: number[][] = [];
  let run: number[] = [];
  for (const angle of best.misses) {
    const previous = run[run.length - 1];
    if (previous !== undefined && angle - previous > ANGLE_STEP) {
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
  // Samples sit a step apart, so add one step to get the true width.
  const holeWidth =
    runs.reduce((sum, h) => sum + ((h[h.length - 1] ?? 0) - (h[0] ?? 0) + ANGLE_STEP), 0) /
    runs.length;
  return { centre, normal, uAx, rAx, radius, holeR: best.r, holeAngles, holeWidth, isOpen };
}
