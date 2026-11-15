// @vitest-environment node
/**
 * [Req 1.1, 1.6] The phone is prepared for the scene: goo in every finger hole,
 * attached to the wheel so it turns with it, and a readable frame for the card.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { holeRadiusOf } from './goo';
import { angleInDial, radiusInDial } from './dialSpace';
import { computeCardFrame } from './cardTexture';
import { GOO, GOO_SHAPE, PHONE_ROTATION_Y } from './sceneConstants';
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

  it('shades the goo as wet, slightly see-through green slime', () => {
    const pool = descendantsNamed(phone.goo, 'goo-pool')[0] as THREE.Mesh;
    const material = pool.material as THREE.MeshPhysicalMaterial;
    expect(material.clearcoat).toBe(GOO.clearcoat);
    expect(material.roughness).toBeLessThanOrEqual(0.06);
    expect(material.transmission).toBe(GOO.transmission);
    expect(material.thickness).toBe(GOO.thickness);
    expect(material.ior).toBe(GOO.ior);
    expect(material.emissive.getHex()).toBe(GOO.emissive);
    expect(material.emissiveIntensity).toBeLessThanOrEqual(0.3);
    expect(material.vertexColors).toBe(true);
  });

  it('colours a pool deep green in the thick middle and dark olive at its thin rim', () => {
    const pool = descendantsNamed(phone.goo, 'goo-pool')[0] as THREE.Mesh;
    const position = pool.geometry.getAttribute('position');
    const color = pool.geometry.getAttribute('color');
    // Vertex 0 is the middle of the pool. The highest point is off to one side, as the dome is lopsided.
    let floor = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < position.getY(floor)) floor = i;
    }
    expect(new THREE.Color().fromBufferAttribute(color, 0).getHex()).toBe(GOO.thickColour);
    expect(new THREE.Color().fromBufferAttribute(color, floor).getHex()).toBe(GOO.thinColour);
  });

  it('runs each drip from green near the hole to dark olive at the tip', () => {
    const drip = descendantsNamed(phone.goo, 'goo-drip')[0] as THREE.Mesh;
    const color = drip.geometry.getAttribute('color');
    const brightness = (i: number) => {
      const c = new THREE.Color().fromBufferAttribute(color, i);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    // Rings of 11 vertices run from the hole to the tip.
    expect(brightness(0)).toBeGreaterThan(brightness(color.count - 1));
  });
});

describe('slime shape on the real dial', () => {
  const meshes = (name: string) => descendantsNamed(phone.goo, name) as THREE.Mesh[];
  const holeRadius = () => holeRadiusOf(phone.dial);
  const worldVertices = (mesh: THREE.Mesh) => {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    return Array.from({ length: position.count }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
    );
  };
  const originOf = (mesh: THREE.Mesh) => mesh.getWorldPosition(new THREE.Vector3());
  const downhill = () => {
    const { normal } = phone.dial;
    return new THREE.Vector3(0, -1, 0).addScaledVector(normal, normal.y).normalize();
  };
  const outwardOf = (point: THREE.Vector3) => {
    const { centre, normal } = phone.dial;
    const d = point.clone().sub(centre);
    return d.addScaledVector(normal, -d.dot(normal)).normalize();
  };
  const heightAboveFace = (point: THREE.Vector3) =>
    point.clone().sub(phone.dial.centre).dot(phone.dial.normal) - phone.dial.faceHeight;

  it('[Req 1.1] runs only 2 or 3 drips', () => {
    const count = meshes('goo-drip').length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(GOO_SHAPE.maxDrips);
  });

  it('drips only from holes in the lower half of the dial', () => {
    for (const drip of meshes('goo-drip')) {
      expect(outwardOf(originOf(drip)).dot(downhill())).toBeGreaterThan(GOO_SHAPE.lowerHalf);
    }
  });

  it('starts each drip at the rim of its hole, with open hole on one side and wheel on the other', () => {
    const { dial } = phone;
    for (const drip of meshes('goo-drip')) {
      const origin = originOf(drip);
      const reach = holeRadius() * 0.6;
      let open = 0;
      let closed = 0;
      for (let k = 0; k < 24; k++) {
        const t = (k / 24) * Math.PI * 2;
        const sample = origin
          .clone()
          .addScaledVector(dial.uAx, Math.cos(t) * reach)
          .addScaledVector(dial.rAx, Math.sin(t) * reach);
        if (dial.isOpen(radiusInDial(sample, dial), angleInDial(sample, dial))) open++;
        else closed++;
      }
      expect(open).toBeGreaterThan(2);
      expect(closed).toBeGreaterThan(2);
    }
  });

  it('runs each drip outward and downhill, never towards the centre card', () => {
    const { dial } = phone;
    for (const drip of meshes('goo-drip')) {
      const origin = originOf(drip);
      const vertices = worldVertices(drip);
      const tip = vertices.reduce((far, v) =>
        v.distanceTo(origin) > far.distanceTo(origin) ? v : far,
      );
      const direction = tip.clone().sub(origin);
      direction.addScaledVector(dial.normal, -direction.dot(dial.normal)).normalize();
      expect(direction.dot(outwardOf(origin))).toBeGreaterThan(0.5);
      expect(direction.dot(downhill())).toBeGreaterThan(0.2);
      // No part of it reaches closer to the middle of the dial than where it started.
      const startRadius = radiusInDial(origin, dial);
      for (const v of vertices)
        expect(radiusInDial(v, dial)).toBeGreaterThan(startRadius - holeRadius() * 0.7);
    }
  });

  it('keeps each drip short: 0.4 to 0.7 of a hole diameter past the rim', () => {
    for (const drip of meshes('goo-drip')) {
      const origin = originOf(drip);
      const reach = Math.max(...worldVertices(drip).map((v) => v.distanceTo(origin)));
      const diameter = holeRadius() * 2;
      expect(reach / diameter).toBeGreaterThan(GOO_SHAPE.dripLength.min * 0.97);
      expect(reach / diameter).toBeLessThan(GOO_SHAPE.dripLength.max * 1.03);
    }
  });

  it('lays each drip on the face of the wheel, as a low blob', () => {
    for (const drip of meshes('goo-drip')) {
      const heights = worldVertices(drip).map(heightAboveFace);
      expect(Math.min(...heights)).toBeGreaterThan(-0.0003);
      expect(Math.max(...heights)).toBeLessThan(holeRadius() * 0.5);
    }
  });

  it('fills some holes much more than others', () => {
    const tops = meshes('goo-pool').map((pool) =>
      Math.max(
        ...worldVertices(pool).map((v) => v.clone().sub(phone.dial.centre).dot(phone.dial.normal)),
      ),
    );
    const floor = Math.min(
      ...meshes('goo-pool').map((pool) =>
        originOf(pool).clone().sub(phone.dial.centre).dot(phone.dial.normal),
      ),
    );
    const depths = tops.map((t) => t - floor);
    expect(Math.max(...depths) / Math.min(...depths)).toBeGreaterThan(1.8);
  });

  it('gives every pool its own uneven outline', () => {
    const outlines = meshes('goo-pool').map((pool) => {
      const radii = worldVertices(pool).map((v) => radiusInDial(v, phone.dial));
      return Math.round(Math.max(...radii) * 1e6);
    });
    expect(new Set(outlines).size).toBeGreaterThan(5);
  });

  it('smears slime over the rim of the fullest holes, including every dripping hole', () => {
    const smeared = new Set(meshes('goo-smear').map((m) => m.userData['hole']));
    expect(smeared.size).toBeGreaterThanOrEqual(meshes('goo-drip').length);
    expect(smeared.size).toBeLessThanOrEqual(6);
    for (const drip of meshes('goo-drip')) expect(smeared.has(drip.userData['hole'])).toBe(true);
    expect(smeared.size).toBeLessThan(10);
  });

  it('makes the slime a child of the wheel, with every piece in the goo group', () => {
    const names = new Set<string>();
    phone.goo.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) names.add(o.name);
    });
    expect([...names].sort()).toEqual(['goo-drip', 'goo-pool', 'goo-smear']);
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
