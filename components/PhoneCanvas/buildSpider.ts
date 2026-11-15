import * as THREE from 'three';
import { seededRandom } from './noise';

type Hair = { position: THREE.Vector3; direction: THREE.Vector3; length: number };

export type Spider = {
  group: THREE.Group;
  /** The legs, so a scene can make one twitch. */
  legs: THREE.Mesh[];
};

const ABDOMEN_RADIUS = 0.0055;
const THORAX_RADIUS = 0.0035;

/**
 * A small hairy spider: oval body, eight tapered legs with pale bands at the
 * joints, and a coat of fine hairs. Ported from assets-src/scene-test.html.
 */
export function buildSpider(): Spider {
  const random = seededRandom(5);
  const group = new THREE.Group();
  group.name = 'spider';
  const legs: THREE.Mesh[] = [];
  const hairs: Hair[] = [];

  const material = new THREE.MeshPhysicalMaterial({
    color: 0x0d0a08,
    roughness: 0.7,
    clearcoat: 0.15,
    clearcoatRoughness: 0.4,
    sheen: 1,
    sheenColor: new THREE.Color(0x3a2a1a),
    sheenRoughness: 0.6,
  });
  const abdomen = new THREE.Mesh(
    new THREE.SphereGeometry(ABDOMEN_RADIUS, 24, 24),
    material.clone(),
  );
  abdomen.scale.set(1, 0.8, 1.35);
  abdomen.position.set(0, 0.0045, -0.006);
  (abdomen.material as THREE.MeshPhysicalMaterial).color.setHex(0x1a120c);
  const thorax = new THREE.Mesh(new THREE.SphereGeometry(THORAX_RADIUS, 20, 20), material);
  thorax.scale.set(1, 0.7, 1.1);
  thorax.position.set(0, 0.0035, 0.0015);
  group.add(abdomen, thorax);

  const bandMaterial = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.9 });
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const angle = -0.75 + i * 0.5;
      const dirX = Math.cos(angle) * side;
      const dirZ = Math.sin(angle) * 1.2;
      const p0 = new THREE.Vector3(side * 0.0025, 0.0035, 0.0015 + (i - 1.5) * 0.0012);
      const curve = new THREE.CatmullRomCurve3([
        p0,
        p0.clone().add(new THREE.Vector3(dirX * 0.008, 0.0075, dirZ * 0.006)),
        p0.clone().add(new THREE.Vector3(dirX * 0.013, 0.004, dirZ * 0.0105)),
        p0.clone().add(new THREE.Vector3(dirX * 0.017, 0, dirZ * 0.014)),
      ]);
      const geometry = new THREE.TubeGeometry(curve, 24, 0.0006, 8);

      // Taper each leg towards the foot.
      const positions = geometry.getAttribute('position');
      const vertex = new THREE.Vector3();
      for (let k = 0; k < positions.count; k++) {
        const along = Math.floor(k / 9) / 24;
        const spine = curve.getPoint(along);
        vertex
          .fromBufferAttribute(positions, k)
          .sub(spine)
          .multiplyScalar(1.2 - along * 0.8)
          .add(spine);
        positions.setXYZ(k, vertex.x, vertex.y, vertex.z);
      }
      geometry.computeVertexNormals();

      const leg = new THREE.Mesh(geometry, material);
      legs.push(leg);
      group.add(leg);

      for (let k = 0; k < 70; k++) {
        const f = random();
        const spine = curve.getPoint(f);
        const tangent = curve.getTangent(f);
        const outward = new THREE.Vector3(random() - 0.5, random() - 0.5, random() - 0.5)
          .cross(tangent)
          .normalize();
        hairs.push({
          position: spine.addScaledVector(outward, 0.0005 * (1.2 - f * 0.8)),
          direction: outward.addScaledVector(tangent, 0.6).normalize(),
          length: 0.0009 + random() * 0.0012,
        });
      }
      for (const f of [0.33, 0.66]) {
        const band = new THREE.Mesh(
          new THREE.SphereGeometry(0.00075 * (1.2 - f * 0.8), 8, 6),
          bandMaterial,
        );
        band.position.copy(curve.getPoint(f));
        band.scale.set(1, 1, 1.6);
        group.add(band);
      }
    }
  }

  const bodyHairs: Array<[THREE.Mesh, number, number]> = [
    [abdomen, 900, ABDOMEN_RADIUS],
    [thorax, 300, THORAX_RADIUS],
  ];
  for (const [mesh, count, radius] of bodyHairs) {
    for (let k = 0; k < count; k++) {
      const d = new THREE.Vector3(random() - 0.5, random() * 0.9 - 0.2, random() - 0.5).normalize();
      const position = new THREE.Vector3(
        d.x * radius * mesh.scale.x,
        d.y * radius * mesh.scale.y,
        d.z * radius * mesh.scale.z,
      ).add(mesh.position);
      hairs.push({
        position,
        direction: d
          .clone()
          .add(new THREE.Vector3(0, 0, -0.8))
          .normalize(),
        length: 0.0008 + random() * 0.001,
      });
    }
  }

  const hairGeometry = new THREE.CylinderGeometry(0.00004, 0.00011, 1, 4);
  hairGeometry.translate(0, 0.5, 0);
  const coat = new THREE.InstancedMesh(
    hairGeometry,
    new THREE.MeshStandardMaterial({ color: 0x2a2018, roughness: 0.8 }),
    hairs.length,
  );
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  hairs.forEach((hair, i) => {
    rotation.setFromUnitVectors(yAxis, hair.direction);
    scale.set(1, hair.length, 1);
    matrix.compose(hair.position, rotation, scale);
    coat.setMatrixAt(i, matrix);
  });
  group.add(coat);

  group.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { group, legs };
}
