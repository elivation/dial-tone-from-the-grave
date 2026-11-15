// @vitest-environment node
/**
 * [Req 1.1, 1.6] The phone is prepared for the scene: pools of goo in every finger hole,
 * attached to the wheel so they turn with it, drips on the fixed number plate that never turn,
 * and a readable frame for the card.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { holeRadiusOf } from './goo';
import { angleInDial, downhillOf, radiusInDial } from './dialSpace';
import { computeCardFrame } from './cardTexture';
import { GOO, GOO_SHAPE, PHONE_ROTATION_Y } from './sceneConstants';
import { pointAt } from './__fixtures__/dial';
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
    const drip = descendantsNamed(phone.drips, 'goo-drip')[0] as THREE.Mesh;
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
  const downhill = () => downhillOf(phone.dial.normal);
  const drips = () => descendantsNamed(phone.drips, 'goo-drip') as THREE.Mesh[];
  const holeCentre = (drip: THREE.Mesh) =>
    pointAt(
      phone.dial,
      phone.dial.holeAngles[drip.userData['hole'] as number] ?? 0,
      phone.dial.holeR,
    );
  const outwardOf = (point: THREE.Vector3) => {
    const { centre, normal } = phone.dial;
    const d = point.clone().sub(centre);
    return d.addScaledVector(normal, -d.dot(normal)).normalize();
  };
  it('[Req 1.1] runs only 2 or 3 drips', () => {
    const count = drips().length;
    expect(count).toBeGreaterThanOrEqual(2);
    expect(count).toBeLessThanOrEqual(GOO_SHAPE.maxDrips);
  });

  it('parents the drips to the static phone body, never to the finger wheel', () => {
    for (const drip of drips()) {
      const chain: THREE.Object3D[] = [];
      for (let node: THREE.Object3D | null = drip; node; node = node.parent) chain.push(node);
      expect(chain).toContain(phone.object);
      expect(chain).not.toContain(phone.wheel);
    }
  });

  it('drips only from holes in the lower half of the dial', () => {
    for (const drip of drips()) {
      expect(outwardOf(holeCentre(drip)).dot(downhill())).toBeGreaterThan(GOO_SHAPE.lowerHalf);
    }
  });

  it('starts each drip just outside the rim of its hole, on solid wheel and not in an opening', () => {
    const { dial } = phone;
    for (const drip of drips()) {
      const origin = originOf(drip);
      const r = radiusInDial(origin, dial);
      const at = angleInDial(origin, dial);
      expect(dial.isOpen(r, at)).toBe(false);
      // The nearest opening at rest is less than a hole radius away, so the drip is at the rim, not adrift.
      let nearest = Infinity;
      for (
        let reach = 0.0002;
        reach <= holeRadius() * 1.5 && nearest === Infinity;
        reach += 0.0002
      ) {
        for (let k = 0; k < 72; k++) {
          const t = (k / 72) * Math.PI * 2;
          const du = r * Math.cos((at * Math.PI) / 180) + reach * Math.cos(t);
          const dr = r * Math.sin((at * Math.PI) / 180) + reach * Math.sin(t);
          const degrees = (Math.atan2(dr, du) * 180) / Math.PI;
          if (dial.isOpen(Math.hypot(du, dr), degrees)) nearest = Math.min(nearest, reach);
        }
      }
      expect(nearest).toBeLessThan(holeRadius());
    }
  });

  it('runs each drip downhill, found by projecting world down onto the dial plane', () => {
    const { dial } = phone;
    const up = new THREE.Vector3(0, 1, 0);
    for (const drip of drips()) {
      const origin = originOf(drip);
      // The drip closes to a point, so its last ring of vertices is where it ends.
      const ring = worldVertices(drip).slice(-15);
      const tip = ring
        .reduce((sum, v) => sum.add(v), new THREE.Vector3())
        .divideScalar(ring.length);
      const direction = tip.clone().sub(origin);
      direction.addScaledVector(dial.normal, -direction.dot(dial.normal)).normalize();
      expect(direction.dot(up)).toBeLessThan(0);
      expect(direction.dot(downhill())).toBeGreaterThan(0.9);
    }
  });

  it('never lets a drip overlap a finger hole, at any wheel angle from 0 to 330 degrees', () => {
    const { dial } = phone;
    for (const drip of drips()) {
      for (const v of worldVertices(drip)) {
        const r = radiusInDial(v, dial);
        // Past the rim of the wheel there are no holes to pass over.
        if (r >= dial.radius * 0.97) continue;
        const at = angleInDial(v, dial);
        for (let turn = 0; turn <= 330; turn += 1) {
          expect(dial.isOpen(r, at - turn), `r ${r}, ${at} degrees, wheel at ${turn}`).toBe(false);
        }
      }
    }
  });

  it('keeps every drip clear of the centre card, outside the ring the holes sit on', () => {
    for (const drip of drips()) {
      for (const v of worldVertices(drip)) {
        expect(radiusInDial(v, phone.dial)).toBeGreaterThan(phone.dial.holeR);
      }
    }
  });

  it('keeps each drip short: 0.4 to 0.7 of a hole diameter long', () => {
    for (const drip of drips()) {
      const origin = originOf(drip);
      const reach = Math.max(...worldVertices(drip).map((v) => v.distanceTo(origin)));
      const diameter = holeRadius() * 2;
      expect(reach / diameter).toBeGreaterThan(GOO_SHAPE.dripLength.min * 0.97);
      expect(reach / diameter).toBeLessThan(GOO_SHAPE.dripLength.max * 1.03);
    }
  });

  it('lays each drip on the number plate, as a low blob', () => {
    const plate = descendantsNamed(
      phone.object,
      'Dial_Number_Plate_Western_Electric_500_Material_0',
    )[0];
    expect(plate).toBeDefined();
    const raycaster = new THREE.Raycaster();
    const down = phone.dial.normal.clone().negate();
    for (const drip of drips()) {
      let lowest = Infinity;
      for (const v of worldVertices(drip)) {
        raycaster.set(v.clone().addScaledVector(phone.dial.normal, 0.01), down);
        const hit = raycaster.intersectObject(plate as THREE.Object3D, false)[0];
        expect(hit, 'plate under the drip').toBeDefined();
        const height = v
          .clone()
          .sub((hit as THREE.Intersection).point)
          .dot(phone.dial.normal);
        // Sunk a little into the plate, which curves up at its edge, but never floating above it.
        expect(height).toBeGreaterThan(-0.0005);
        expect(height).toBeLessThan(holeRadius() * 0.5);
        lowest = Math.min(lowest, height);
      }
      expect(lowest, 'the drip touches the plate').toBeLessThan(0.0001);
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
    expect(smeared.size).toBeGreaterThanOrEqual(drips().length);
    expect(smeared.size).toBeLessThanOrEqual(6);
    for (const drip of drips()) expect(smeared.has(drip.userData['hole'])).toBe(true);
    expect(smeared.size).toBeLessThan(10);
  });

  it('keeps pools and smears in the goo group on the wheel, and drips in their own group', () => {
    const names = (root: THREE.Object3D) => {
      const found = new Set<string>();
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) found.add(o.name);
      });
      return [...found].sort();
    };
    expect(names(phone.goo)).toEqual(['goo-pool', 'goo-smear']);
    expect(names(phone.drips)).toEqual(['goo-drip']);
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
