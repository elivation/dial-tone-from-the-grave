import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { glowWithSlimeColour, paintGoo } from './gooColour';
import { seededRandom } from './noise';
import { GOO } from './sceneConstants';

/** How much goo each hole holds, 0 to 1. Holes above DRIP_THRESHOLD also run a drip. Exactly 3 do. */
const AMOUNTS = [1, 0.4, 0.85, 0.2, 0.9, 0.6, 0.3, 0.75, 0.5, 0.7];
const DRIP_THRESHOLD = 0.8;

export type GooInput = {
  dial: DialGeometry;
  /** The number plate under the wheel. Pools sit on it, at the bottom of each hole. */
  plate: THREE.Mesh | undefined;
};

/**
 * Wet green slime pooled in each finger hole, with drips from three of them.
 * Built in world space from raycasts, then attached to the wheel by the caller
 * so it turns with it. Ported from assets-src/scene-test.html.
 */
export function buildGoo({ dial, plate }: GooInput): THREE.Group {
  const { centre, normal, uAx, rAx, radius, holeR, holeAngles, holeWidth, isOpen } = dial;
  const random = seededRandom(11);
  const raycaster = new THREE.Raycaster();
  const into = normal.clone().negate();
  const quaternionToNormal = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    normal,
  );
  // Goo runs downhill across the face of the tilted dial.
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
  const holeRadius = Math.sin(THREE.MathUtils.degToRad(holeWidth / 2)) * holeR * 0.95;
  const goo = new THREE.Group();
  goo.name = 'goo';

  holeAngles.forEach((degrees, i) => {
    // Find where the hole really is along this angle: the stretch of radius the ray passes through.
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

    const amount = AMOUNTS[i % AMOUNTS.length] ?? 0.5;
    const poolRadius = holeRadius * (0.85 + amount * 0.2);
    const poolGeometry = new THREE.SphereGeometry(
      poolRadius,
      32,
      16,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    // Thickest in the middle, thinning to a film at the rim. Measured across the pool, not up it:
    // from above a flat pool is nearly all one height, so height would leave it one even green.
    paintGoo(poolGeometry, (_, p) => 1 - Math.pow(Math.hypot(p.x, p.z) / poolRadius, 1.6));
    const pool = new THREE.Mesh(poolGeometry, material);
    pool.name = 'goo-pool';
    pool.scale.set(1, 0.08 + amount * 0.1, 1);
    pool.position.copy(floor).addScaledVector(normal, -0.0003);
    pool.quaternion.copy(quaternionToNormal);
    goo.add(pool);

    if (amount > DRIP_THRESHOLD) {
      const start = middle.clone().addScaledVector(downhill, holeRadius * 0.8);
      const length = holeR * (0.6 + random() * 0.5);
      const points: THREE.Vector3[] = [];
      for (let k = 0; k <= 8; k++) {
        const f = k / 8;
        points.push(
          start
            .clone()
            .addScaledVector(downhill, length * f)
            .addScaledVector(rAx, Math.sin(f * 3 + i) * 0.0008)
            .addScaledVector(normal, 0.0006 - f * 0.0004),
        );
      }
      const curve = new THREE.CatmullRomCurve3(points);
      const tubularSegments = 40;
      const radialSegments = 10;
      const geometry = new THREE.TubeGeometry(
        curve,
        tubularSegments,
        holeRadius * 0.22,
        radialSegments,
      );

      // Taper the drip and press it flat against the dial.
      const positions = geometry.getAttribute('position');
      const vertex = new THREE.Vector3();
      for (let k = 0; k < positions.count; k++) {
        const along = Math.floor(k / (radialSegments + 1)) / tubularSegments;
        const spine = curve.getPoint(along);
        vertex.fromBufferAttribute(positions, k).sub(spine);
        const flatten = vertex.dot(normal);
        vertex
          .addScaledVector(normal, -flatten * 0.6)
          .multiplyScalar(1 - along * 0.55)
          .add(spine);
        positions.setXYZ(k, vertex.x, vertex.y, vertex.z);
      }
      geometry.computeVertexNormals();
      // Starts as thick as the pool lip and thins to a dark olive tip.
      paintGoo(geometry, (k) => 0.6 * (1 - Math.floor(k / (radialSegments + 1)) / tubularSegments));

      const drip = new THREE.Mesh(geometry, material);
      drip.name = 'goo-drip';
      const tipGeometry = new THREE.SphereGeometry(holeRadius * 0.17, 16, 12);
      paintGoo(tipGeometry, () => 0.1);
      const tip = new THREE.Mesh(tipGeometry, material);
      tip.name = 'goo-tip';
      tip.scale.set(1, 0.55, 1.3);
      tip.quaternion.copy(quaternionToNormal);
      tip.position.copy(curve.getPoint(1));
      goo.add(drip, tip);
    }
  });

  goo.traverse((o) => {
    o.castShadow = true;
  });
  return goo;
}
