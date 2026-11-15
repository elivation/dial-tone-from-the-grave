// @vitest-environment node
/**
 * [Req 1.1, 1.6] The phone is prepared for the scene: goo in every finger hole,
 * attached to the wheel so it turns with it, and a readable frame for the card.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { computeCardFrame } from './cardTexture';
import { PHONE_ROTATION_Y } from './sceneConstants';
import { loadSourcePhone } from './__fixtures__/loadSource';

function descendantsNamed(root: THREE.Object3D, name: string): THREE.Object3D[] {
  const found: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (o.name === name) found.push(o);
  });
  return found;
}

let source: THREE.Group;
let phone: PreparedPhone;

// Loading the model and raycasting for the holes takes a few seconds, so do it once.
beforeAll(async () => {
  source = await loadSourcePhone();
  phone = preparePhone(source);
}, 60_000);

describe('preparePhone', () => {
  it('does not touch the cached source scene', () => {
    expect(source.children.every((c) => c.parent === source)).toBe(true);
    expect(descendantsNamed(source, 'goo')).toHaveLength(0);
  });

  it('sits on the desk at about 23 cm wide', () => {
    const box = new THREE.Box3().setFromObject(phone.object);
    expect(box.min.y).toBeCloseTo(0, 5);
    const size = box.getSize(new THREE.Vector3());
    // Turned 0.3 rad, so the bounding box is a little wider than the phone itself.
    expect(Math.max(size.x, size.z)).toBeGreaterThan(0.2);
    expect(Math.max(size.x, size.z)).toBeLessThan(0.3);
  });

  it('puts a pool of goo in each of the 10 finger holes', () => {
    expect(descendantsNamed(phone.goo, 'goo-pool')).toHaveLength(10);
  });

  it('runs drips from exactly 3 holes', () => {
    expect(descendantsNamed(phone.goo, 'goo-drip')).toHaveLength(3);
    expect(descendantsNamed(phone.goo, 'goo-tip')).toHaveLength(3);
  });

  it('makes the goo a child of the finger wheel, so it turns with it', () => {
    let node: THREE.Object3D | null = phone.goo;
    let underWheel = false;
    while (node) {
      if (node === phone.wheel) underWheel = true;
      node = node.parent;
    }
    expect(underWheel).toBe(true);
  });

  it('keeps every goo mesh in the same place in the world after attaching', () => {
    const pool = descendantsNamed(phone.goo, 'goo-pool')[0];
    expect(pool).toBeDefined();
    const world = new THREE.Vector3();
    pool?.getWorldPosition(world);
    // A pool sits within the wheel's radius of the dial centre.
    expect(world.distanceTo(phone.dial.centre)).toBeLessThan(phone.dial.radius);
  });

  it('shades the goo as glossy black', () => {
    const pool = descendantsNamed(phone.goo, 'goo-pool')[0] as THREE.Mesh;
    const material = pool.material as THREE.MeshPhysicalMaterial;
    expect(material.clearcoat).toBe(1);
    expect(material.roughness).toBeLessThan(0.1);
  });
});

describe('computeCardFrame', () => {
  it('draws text so it reads upright on the dial, whatever way the card is unwrapped', async () => {
    if (!phone.card) throw new Error('The model has no Rotary_Dial_Card mesh');
    const image = { width: 2048, height: 2048, flipY: false };
    const frame = computeCardFrame(phone.card, phone.dial, PHONE_ROTATION_Y, image);

    // Reading axes on the dial: up is towards the back of the phone.
    const { normal } = phone.dial;
    const back = new THREE.Vector3(0, 0, -1).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      PHONE_ROTATION_Y,
    );
    const up = back.sub(normal.clone().multiplyScalar(back.dot(normal))).normalize();
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    const down = up.clone().negate();

    // Invert the text-to-canvas matrix: canvas pixels back to text millimetres.
    const [a, b, c, d] = frame.matrix;
    const det = a * d - b * c;
    const toText = (dx: number, dy: number) => ({
      x: (d * dx - c * dy) / det,
      y: (-b * dx + a * dy) / det,
    });

    const uv = phone.card.geometry.getAttribute('uv');
    const position = phone.card.geometry.getAttribute('position');
    const world = (i: number) =>
      new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(phone.card!.matrixWorld);
    const pixel = (i: number) => ({
      x: uv.getX(i) * image.width,
      y: (image.flipY ? 1 - uv.getY(i) : uv.getY(i)) * image.height,
    });

    const origin = world(0);
    const originPx = pixel(0);
    let checked = 0;
    for (let i = 1; i < position.count; i += 7) {
      const delta = world(i).sub(origin);
      const expected = { x: delta.dot(right) * 1000, y: delta.dot(down) * 1000 };
      const px = pixel(i);
      const got = toText(px.x - originPx.x, px.y - originPx.y);
      expect(Math.abs(got.x - expected.x)).toBeLessThan(frame.radiusMm * 0.06);
      expect(Math.abs(got.y - expected.y)).toBeLessThan(frame.radiusMm * 0.06);
      checked++;
    }
    expect(checked).toBeGreaterThan(5);
    expect(frame.radiusMm).toBeGreaterThan(2);
    expect(frame.radiusMm).toBeLessThan(40);
  });
});
