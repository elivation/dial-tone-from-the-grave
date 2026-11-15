// @vitest-environment node
/**
 * [Req 1.1, 1.6] The phone is prepared for the scene: pools of goo recessed in every finger hole,
 * attached to the wheel so they turn with it, old leak stains on the fixed number plate that never
 * turn, and a readable frame for the card.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { holeRadiusOf } from './goo';
import { angleInDial, downhillOf, radiusInDial } from './dialSpace';
import { computeCardFrame } from './cardTexture';
import { GOO, GOO_SHAPE, PHONE_ROTATION_Y } from './sceneConstants';
import { rimHeightAt } from './__fixtures__/rim';
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

  it('colours each stain darker at its thin edge than in its middle', () => {
    const stain = descendantsNamed(phone.stains, 'goo-stain')[0] as THREE.Mesh;
    const color = stain.geometry.getAttribute('color');
    const brightness = (i: number) => {
      const c = new THREE.Color().fromBufferAttribute(color, i);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    // Vertex 0 is the middle, and the last ring is the edge.
    expect(brightness(0)).toBeGreaterThan(brightness(color.count - 1));
    expect(new THREE.Color().fromBufferAttribute(color, color.count - 1).getHex()).toBe(
      GOO.thinColour,
    );
  });
});

describe('slime on the real dial', () => {
  const pools = () => descendantsNamed(phone.goo, 'goo-pool') as THREE.Mesh[];
  const stains = () => descendantsNamed(phone.stains, 'goo-stain') as THREE.Mesh[];
  const holeRadius = () => holeRadiusOf(phone.dial);
  const worldVertices = (mesh: THREE.Mesh) => {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    return Array.from({ length: position.count }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
    );
  };
  const originOf = (mesh: THREE.Mesh) => mesh.getWorldPosition(new THREE.Vector3());
  const height = (v: THREE.Vector3) => v.clone().sub(phone.dial.centre).dot(phone.dial.normal);
  const cardRadius = () => {
    const card = phone.card as THREE.Mesh;
    return Math.max(...worldVertices(card).map((v) => radiusInDial(v, phone.dial)));
  };

  it('[Req 1.1] keeps the top of every pool at least 0.3 mm below the wheel top around its hole', () => {
    for (const pool of pools()) {
      const rim = rimHeightAt(phone, originOf(pool), holeRadius());
      const top = Math.max(...worldVertices(pool).map(height));
      expect(top, `hole ${pool.userData['hole']}`).toBeLessThanOrEqual(
        rim - GOO_SHAPE.minClearance + 1e-6,
      );
    }
  });

  it('[Req 1.1] keeps every pool inside its hole: nothing pokes into the wheel', () => {
    const { dial } = phone;
    for (const pool of pools()) {
      const middle = originOf(pool);
      for (const v of worldVertices(pool)) {
        // A hair towards the middle of the hole, so the edge of the hole bitmap does not decide it.
        const inside = v.clone().lerp(middle, 0.03);
        expect(dial.isOpen(radiusInDial(inside, dial), angleInDial(inside, dial))).toBe(true);
      }
    }
  });

  it('[Req 1.1] fills the fullest holes to about 80 percent, 0.3 to 1 mm below the rim, and leaves some as a film', () => {
    const gaps = pools().map((pool) => {
      const rim = rimHeightAt(phone, originOf(pool), holeRadius());
      const top = Math.max(...worldVertices(pool).map(height));
      const floor = height(originOf(pool));
      return { gap: rim - top, depth: top - floor, hole: rim - floor };
    });
    const full = gaps.filter((g) => g.gap <= GOO_SHAPE.fullGap.max + 1e-6);
    expect(full.length).toBeGreaterThanOrEqual(2);
    for (const g of full) expect(g.depth / g.hole).toBeGreaterThan(0.7);
    const films = gaps.filter((g) => g.depth < 0.0005);
    expect(films.length).toBeGreaterThanOrEqual(1);
    const depths = gaps.map((g) => g.depth);
    expect(Math.max(...depths) / Math.min(...depths)).toBeGreaterThan(4);
  });

  it('gives every pool its own uneven edge', () => {
    const outlines = pools().map((pool) => {
      const radii = worldVertices(pool).map((v) => v.distanceTo(originOf(pool)));
      return Math.round(Math.max(...radii) * 1e6);
    });
    expect(new Set(outlines).size).toBeGreaterThan(5);
  });

  it('has no rim smears and no drips', () => {
    const names = (root: THREE.Object3D) => {
      const found = new Set<string>();
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) found.add(o.name);
      });
      return [...found].sort();
    };
    expect(names(phone.goo)).toEqual(['goo-pool']);
    expect(names(phone.stains)).toEqual(['goo-stain']);
  });

  it('[Req 1.1] leaves 5 to 7 leak stains', () => {
    expect(stains().length).toBeGreaterThanOrEqual(GOO_SHAPE.stains.min);
    expect(stains().length).toBeLessThanOrEqual(GOO_SHAPE.stains.max);
  });

  it('parents the stains to the static phone body, never to the finger wheel', () => {
    for (const stain of stains()) {
      const chain: THREE.Object3D[] = [];
      for (let node: THREE.Object3D | null = stain; node; node = node.parent) chain.push(node);
      expect(chain).toContain(phone.object);
      expect(chain).not.toContain(phone.wheel);
    }
  });

  it('lays every stain flat on the number plate, under 0.3 mm thick', () => {
    const plate = descendantsNamed(
      phone.object,
      'Dial_Number_Plate_Western_Electric_500_Material_0',
    )[0];
    expect(plate).toBeDefined();
    const raycaster = new THREE.Raycaster();
    const down = phone.dial.normal.clone().negate();
    for (const stain of stains()) {
      for (const v of worldVertices(stain)) {
        raycaster.set(v.clone().addScaledVector(phone.dial.normal, 0.01), down);
        const hit = raycaster.intersectObject(plate as THREE.Object3D, false)[0];
        expect(hit, 'plate under the stain').toBeDefined();
        const above = height(v) - height((hit as THREE.Intersection).point);
        expect(above).toBeGreaterThan(-0.00005);
        expect(above).toBeLessThan(0.0003);
      }
    }
  });

  it('keeps every stain under the wheel and off the centre card', () => {
    for (const stain of stains()) {
      for (const v of worldVertices(stain)) {
        const r = radiusInDial(v, phone.dial);
        expect(r).toBeLessThan(phone.dial.radius * 0.95);
        expect(r).toBeGreaterThan(cardRadius() + 0.0005);
      }
    }
  });

  it('puts the stains under the ring the holes sit on', () => {
    for (const stain of stains()) {
      const r = radiusInDial(originOf(stain), phone.dial);
      expect(Math.abs(r - phone.dial.holeR)).toBeLessThan(holeRadius());
    }
  });

  it('runs some stains a short way downhill, found by projecting world down onto the dial plane', () => {
    const downhill = downhillOf(phone.dial.normal);
    const runners = stains().filter((stain) => {
      const origin = originOf(stain);
      const along = worldVertices(stain).map((v) => v.clone().sub(origin).dot(downhill));
      return Math.max(...along) > -Math.min(...along) * 1.6;
    });
    expect(runners.length).toBeGreaterThanOrEqual(2);
    expect(runners.length).toBeLessThan(stains().length);
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
