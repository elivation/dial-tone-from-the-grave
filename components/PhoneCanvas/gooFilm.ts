import * as THREE from 'three';
import type { DialGeometry } from './dialGeometry';
import { dialUv } from './gooDecals';

/** A face counts as the wheel's top face when it leans this far towards the dial normal. */
const UPWARD = 0.35;

const uvOf = (world: THREE.Vector3, dial: DialGeometry, extent: number) => {
  const d = world.clone().sub(dial.centre);
  return dialUv({ x: d.dot(dial.uAx), y: d.dot(dial.rAx) }, extent);
};

/**
 * A skin over the wheel's top face, for painted smears and streaks. It shares the wheel's own
 * vertices, keeps only the faces that look up out of the dial, and is mapped flat onto the dial
 * plane so dial space and canvas line up. Added to the wheel, so it turns with it.
 */
export function buildWheelFilm(wheel: THREE.Mesh, dial: DialGeometry, extent: number): THREE.Mesh {
  wheel.updateWorldMatrix(true, false);
  const source = wheel.geometry;
  const position = source.getAttribute('position');
  const world = Array.from({ length: position.count }, (_, i) =>
    new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(wheel.matrixWorld),
  );
  const uv = new Float32Array(position.count * 2);
  world.forEach((v, i) => {
    const { u, v: w } = uvOf(v, dial, extent);
    uv[i * 2] = THREE.MathUtils.clamp(u, 0, 1);
    uv[i * 2 + 1] = THREE.MathUtils.clamp(w, 0, 1);
  });
  const index = source.getIndex();
  const corner = (t: number) => (index ? index.getX(t) : t);
  const count = index ? index.count : position.count;
  const kept: number[] = [];
  for (let t = 0; t < count; t += 3) {
    const a = world[corner(t)] as THREE.Vector3;
    const b = world[corner(t + 1)] as THREE.Vector3;
    const c = world[corner(t + 2)] as THREE.Vector3;
    const n = b.clone().sub(a).cross(c.clone().sub(a));
    if (n.lengthSq() < 1e-20) continue;
    if (n.normalize().dot(dial.normal) > UPWARD) kept.push(corner(t), corner(t + 1), corner(t + 2));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  const normalAttribute = source.getAttribute('normal');
  if (normalAttribute) geometry.setAttribute('normal', normalAttribute);
  geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(kept);
  // Hidden until the painter gives it its textures in the browser.
  const film = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({ transparent: true, opacity: 0, depthWrite: false }),
  );
  film.name = 'goo-film';
  film.visible = false;
  film.renderOrder = wheel.renderOrder + 1;
  wheel.add(film);
  return film;
}

/**
 * Gives the number plate its own copy of its geometry with a `gooUv` attribute: the plate mapped
 * flat onto the dial plane. The plate's shader uses it to lay painted goo and live trails over the
 * plate itself, so they show through the clear wheel. The cached model is left alone.
 */
export function addPlateGooUv(plate: THREE.Mesh, dial: DialGeometry, extent: number): void {
  plate.updateWorldMatrix(true, false);
  const geometry = plate.geometry.clone();
  const position = geometry.getAttribute('position');
  const uv = new Float32Array(position.count * 2);
  const v = new THREE.Vector3();
  for (let i = 0; i < position.count; i++) {
    v.fromBufferAttribute(position, i).applyMatrix4(plate.matrixWorld);
    const { u, v: w } = uvOf(v, dial, extent);
    uv[i * 2] = u;
    uv[i * 2 + 1] = w;
  }
  geometry.setAttribute('gooUv', new THREE.BufferAttribute(uv, 2));
  plate.geometry = geometry;
}
