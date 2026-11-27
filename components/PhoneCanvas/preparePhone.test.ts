// @vitest-environment node
/**
 * [Req 1.1, 1.6] The phone is prepared for the scene: pools of goo recessed in every finger hole,
 * attached to the wheel so they turn with it, old leak stains on the fixed number plate that never
 * turn, and a readable frame for the card.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import * as THREE from 'three';
import { preparePhone, type PreparedPhone } from './preparePhone';
import { holeOpenings, holeRadiusOf, type HoleOpening } from './goo';
import { strokeRadii } from './gooDecals';
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

/**
 * Thin edges are dark olive, and drying makes them darker still, but never grey or brown-black:
 * still more green than red or blue.
 */
function expectCrustedOlive(edge: THREE.Color) {
  const olive = new THREE.Color(GOO.thinColour);
  const luminance = (c: THREE.Color) => 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  expect(luminance(edge)).toBeLessThanOrEqual(luminance(olive) + 1e-6);
  expect(edge.g).toBeGreaterThan(edge.r);
  expect(edge.g).toBeGreaterThan(edge.b);
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
    expect(material.emissiveIntensity).toBe(GOO.emissiveIntensity);
    expect(material.vertexColors).toBe(true);
  });

  it('colours a pool deep green in the thick middle and dark, drying olive at its thin rim', () => {
    const pool = descendantsNamed(phone.goo, 'goo-pool')[0] as THREE.Mesh;
    const position = pool.geometry.getAttribute('position');
    const color = pool.geometry.getAttribute('color');
    // Vertex 0 is the middle of the pool. The highest point is off to one side, as the dome is lopsided.
    let floor = 0;
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) < position.getY(floor)) floor = i;
    }
    expect(new THREE.Color().fromBufferAttribute(color, 0).getHex()).toBe(GOO.thickColour);
    expectCrustedOlive(new THREE.Color().fromBufferAttribute(color, floor));
  });

  it('colours each stain darker at its thin edge than in its middle', () => {
    const stain = descendantsNamed(phone.bodyGoo, 'goo-stain')[0] as THREE.Mesh;
    const color = stain.geometry.getAttribute('color');
    const brightness = (i: number) => {
      const c = new THREE.Color().fromBufferAttribute(color, i);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    // Vertex 0 is the middle, and the last ring is the edge.
    expect(brightness(0)).toBeGreaterThan(brightness(color.count - 1));
    expectCrustedOlive(new THREE.Color().fromBufferAttribute(color, color.count - 1));
  });
});

describe('slime on the real dial', () => {
  const pools = () => descendantsNamed(phone.goo, 'goo-pool') as THREE.Mesh[];
  const stains = () => descendantsNamed(phone.bodyGoo, 'goo-stain') as THREE.Mesh[];
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

  it('[Req 1.1] keeps the wheel goo on the wheel and the body goo on the static body', () => {
    const names = (root: THREE.Object3D) => {
      const found = new Set<string>();
      root.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) found.add(o.name);
      });
      return [...found].sort();
    };
    expect(names(phone.goo)).toEqual([
      'goo-glob',
      'goo-grime',
      'goo-pool',
      'goo-spill',
      'goo-strand',
    ]);
    expect(names(phone.bodyGoo)).toEqual([
      'goo-puddle',
      'goo-run',
      'goo-specks',
      'goo-stain',
      'goo-stop',
    ]);
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

describe('horror goo on the real phone', () => {
  const named = (root: THREE.Object3D, name: string) =>
    descendantsNamed(root, name) as THREE.Mesh[];
  const worldVertices = (mesh: THREE.Mesh) => {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute('position');
    return Array.from({ length: position.count }, (_, i) =>
      new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld),
    );
  };
  const height = (v: THREE.Vector3) => v.clone().sub(phone.dial.centre).dot(phone.dial.normal);
  const raycaster = new THREE.Raycaster();
  /** Height of the wheel's top surface straight under a point, or null over a hole. */
  const wheelTopUnder = (v: THREE.Vector3): number | null => {
    raycaster.set(
      v.clone().addScaledVector(phone.dial.normal, 0.02),
      phone.dial.normal.clone().negate(),
    );
    const hit = raycaster.intersectObject(phone.wheel, false)[0];
    return hit ? height(hit.point) : null;
  };
  const centreOf = (vs: THREE.Vector3[]) =>
    vs.reduce((sum, v) => sum.add(v), new THREE.Vector3()).divideScalar(vs.length);
  const openingCentre = (hole: number) => {
    const o = holeOpenings(phone.dial)[hole] as HoleOpening;
    return phone.dial.centre
      .clone()
      .addScaledVector(phone.dial.uAx, o.x)
      .addScaledVector(phone.dial.rAx, o.y);
  };
  const inPlaneDistance = (a: THREE.Vector3, b: THREE.Vector3) => {
    const d = a.clone().sub(b);
    return d.addScaledVector(phone.dial.normal, -d.dot(phone.dial.normal)).length();
  };
  const cardRadius = () => phone.decals.cardRadius;

  it('[Req 1.1] puts globs of goo on the webs between holes, sitting on the wheel', () => {
    const globs = named(phone.goo, 'goo-glob');
    expect(globs.length).toBe(GOO_SHAPE.globs);
    for (const glob of globs) {
      const origin = glob.getWorldPosition(new THREE.Vector3());
      expect(
        phone.dial.isOpen(radiusInDial(origin, phone.dial), angleInDial(origin, phone.dial)),
      ).toBe(false);
      const top = wheelTopUnder(origin);
      expect(top).not.toBeNull();
      expect(Math.abs(height(origin) - (top as number))).toBeLessThan(0.0003);
      expect(Math.abs(radiusInDial(origin, phone.dial) - phone.dial.holeR)).toBeLessThan(0.004);
    }
  });

  it('[Req 1.1] hangs one sagging strand from a full hole into the next hole', () => {
    const [strand] = named(phone.goo, 'goo-strand');
    expect(strand).toBeDefined();
    const vertices = worldVertices(strand as THREE.Mesh);
    const sides = (strand as THREE.Mesh).userData['sides'] as number;
    const start = centreOf(vertices.slice(0, sides + 1));
    const end = centreOf(vertices.slice(-(sides + 1)));
    const from = (strand as THREE.Mesh).userData['from'] as number;
    const to = (strand as THREE.Mesh).userData['to'] as number;
    expect(phone.decals.fullHoles).toContain(from);
    const openings = holeOpenings(phone.dial);
    const gap = Math.abs(
      (((((openings[from] as HoleOpening).degrees - (openings[to] as HoleOpening).degrees) % 360) +
        540) %
        360) -
        180,
    );
    expect(gap).toBeGreaterThan(25);
    expect(gap).toBeLessThan(35);
    expect(inPlaneDistance(start, openingCentre(from))).toBeLessThan(
      (openings[from] as HoleOpening).radius,
    );
    expect(inPlaneDistance(end, openingCentre(to))).toBeLessThan(
      (openings[to] as HoleOpening).radius,
    );
    // It sags: between the two rims it crosses, the middle hangs lower in the world than a
    // straight line from rim to rim. The path runs through five points: pool, rim, web, rim, pool.
    const ringCount = vertices.length / (sides + 1);
    const ring = (i: number) => centreOf(vertices.slice(i * (sides + 1), (i + 1) * (sides + 1)));
    const quarter = Math.round((ringCount - 1) / 4);
    const rimA = ring(quarter);
    const rimB = ring(ringCount - 1 - quarter);
    const middle = ring(Math.round((ringCount - 1) / 2));
    expect(middle.y).toBeLessThan((rimA.y + rimB.y) / 2);
  });

  it('[Req 1.1] puts goo on the finger stop where fingers hit it, clear of the turning wheel', () => {
    const stop = named(phone.bodyGoo, 'goo-stop');
    expect(stop.length).toBeGreaterThanOrEqual(1);
    const edge = phone.decals.stopEdge;
    const near = stop.flatMap(worldVertices).some((v) => v.distanceTo(edge) < 0.0012);
    expect(near).toBe(true);
    for (const v of stop.flatMap(worldVertices)) {
      const top = wheelTopUnder(v);
      if (top !== null) expect(height(v)).toBeGreaterThan(top + 0.0001);
    }
  });

  it('[Req 1.1] spatters fine specks on the body round the dial, never on the wheel', () => {
    const [specks] = named(phone.bodyGoo, 'goo-specks');
    expect(specks).toBeDefined();
    const count = (specks as THREE.Mesh).userData['count'] as number;
    expect(count).toBeGreaterThanOrEqual(150);
    for (const v of worldVertices(specks as THREE.Mesh)) {
      expect(radiusInDial(v, phone.dial)).toBeGreaterThan(phone.dial.radius * 1.03);
    }
  });

  it('[Req 1.1] runs one thick run from the bottom of the dial down the front of the phone to the desk', () => {
    const runs = named(phone.bodyGoo, 'goo-run');
    const ribbon = runs.find((r) => r.userData['part'] === 'ribbon') as THREE.Mesh;
    expect(ribbon).toBeDefined();
    const path = ribbon.userData['path'] as THREE.Vector3[];
    const first = path[0] as THREE.Vector3;
    expect(radiusInDial(first, phone.dial)).toBeGreaterThan(phone.dial.radius);
    expect(radiusInDial(first, phone.dial)).toBeLessThan(phone.dial.radius * 1.5);
    const downhillAngle = angleInDial(
      phone.dial.centre.clone().add(downhillOf(phone.dial.normal)),
      phone.dial,
    );
    const off = Math.abs(
      ((((angleInDial(first, phone.dial) - downhillAngle) % 360) + 540) % 360) - 180,
    );
    expect(off).toBeLessThan(25);
    // Gravity: every step goes down in the world.
    for (let i = 1; i < path.length; i++)
      expect((path[i] as THREE.Vector3).y).toBeLessThan((path[i - 1] as THREE.Vector3).y);
    const lowest = Math.min(...runs.flatMap(worldVertices).map((v) => v.y));
    expect(lowest).toBeLessThan(0.003);
  });

  it('[Req 1.1] drapes the run flat on the body: every point lies on the surface, never standing off it', () => {
    const ribbon = named(phone.bodyGoo, 'goo-run').find(
      (r) => r.userData['part'] === 'ribbon',
    ) as THREE.Mesh;
    const path = ribbon.userData['path'] as THREE.Vector3[];
    const normals = ribbon.userData['normals'] as THREE.Vector3[];
    const across = ribbon.userData['across'] as number;
    const vertices = worldVertices(ribbon);
    const body: THREE.Mesh[] = [];
    phone.object.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && /Main_Body|Number_Plate|Base_Plate/.test(o.name))
        body.push(o as THREE.Mesh);
    });
    path.forEach((point, i) => {
      const n = normals[i] as THREE.Vector3;
      const ring = vertices.slice(i * (across + 1), (i + 1) * (across + 1));
      for (const v of ring) {
        raycaster.set(v.clone().addScaledVector(n, 0.003), n.clone().negate());
        const hit = raycaster.intersectObjects(body, false)[0];
        expect(hit, `ring ${i}`).toBeDefined();
        const above = (hit as THREE.Intersection).distance - 0.003;
        expect(above, `ring ${i}`).toBeGreaterThan(-0.0001);
        expect(above, `ring ${i}`).toBeLessThan(0.0007);
      }
      // Flat: many times wider than it is thick.
      const width = (ring[0] as THREE.Vector3).distanceTo(ring[across] as THREE.Vector3);
      const thick = Math.max(...ring.map((v) => v.clone().sub(point).dot(n)));
      expect(width / Math.max(thick, 1e-6), `ring ${i}`).toBeGreaterThan(6);
    });
  });

  it('[Req 1.1] gathers the run into 2 or 3 bulges, with uneven width and a crusted edge', () => {
    const ribbon = named(phone.bodyGoo, 'goo-run').find(
      (r) => r.userData['part'] === 'ribbon',
    ) as THREE.Mesh;
    const bulges = ribbon.userData['bulges'] as number[];
    const widths = ribbon.userData['widths'] as number[];
    expect(bulges.length).toBeGreaterThanOrEqual(2);
    expect(bulges.length).toBeLessThanOrEqual(3);
    const sorted = [...widths].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] as number;
    for (const s of bulges) {
      const near = widths[Math.round(s * (widths.length - 1))] as number;
      expect(near).toBeGreaterThan(median * 1.25);
    }
    expect(Math.max(...widths) / Math.min(...widths)).toBeGreaterThan(1.5);
    const across = ribbon.userData['across'] as number;
    const crust = ribbon.geometry.getAttribute('crust');
    for (let i = 0; i < widths.length; i++) {
      const edge = crust.getX(i * (across + 1));
      const middle = crust.getX(i * (across + 1) + across / 2);
      expect(edge).toBeGreaterThan(middle + 0.3);
    }
  });

  it('[Req 1.1] hangs the run off the bottom edge as a widening sheet into the puddle', () => {
    const curtain = named(phone.bodyGoo, 'goo-run').find(
      (r) => r.userData['part'] === 'curtain',
    ) as THREE.Mesh;
    expect(curtain).toBeDefined();
    const widths = curtain.userData['widths'] as number[];
    expect(widths.at(-1) as number).toBeGreaterThan((widths[0] as number) * 1.4);
    const [puddle] = named(phone.bodyGoo, 'goo-puddle');
    const pv = worldVertices(puddle as THREE.Mesh);
    const middle = centreOf(pv);
    const reach = Math.max(...pv.map((v) => Math.hypot(v.x - middle.x, v.z - middle.z)));
    expect(reach).toBeGreaterThan((widths.at(-1) as number) / 2);
  });

  it('[Req 1.1] lets 4 or 5 pools spill: each runs from its pool, over the rim, onto the wheel face', () => {
    const spills = named(phone.goo, 'goo-spill');
    const film = phone.decals.film;
    expect(spills.length).toBe(film.overflowHoles.length);
    const openings = holeOpenings(phone.dial);
    for (const spill of spills) {
      const hole = spill.userData['hole'] as number;
      expect(film.overflowHoles).toContain(hole);
      const path = spill.userData['path'] as THREE.Vector3[];
      const first = path[0] as THREE.Vector3;
      const last = path.at(-1) as THREE.Vector3;
      const opening = openings[hole] as HoleOpening;
      // Starts in the pool, below the rim.
      expect(inPlaneDistance(first, openingCentre(hole))).toBeLessThan(opening.radius);
      const pool = named(phone.goo, 'goo-pool').find(
        (p) => p.userData['hole'] === hole,
      ) as THREE.Mesh;
      const poolTop = Math.max(...worldVertices(pool).map(height));
      expect(height(first)).toBeLessThanOrEqual(poolTop + 0.0001);
      expect(height(first)).toBeGreaterThan(poolTop - 0.0008);
      // Ends on the wheel's top face, outside the hole.
      const top = wheelTopUnder(last);
      expect(top).not.toBeNull();
      expect(Math.abs(height(last) - (top as number))).toBeLessThan(0.0003);
      expect(inPlaneDistance(last, openingCentre(hole))).toBeGreaterThan(opening.radius);
      // Continuous: no gaps along the way.
      for (let i = 1; i < path.length; i++) {
        expect((path[i] as THREE.Vector3).distanceTo(path[i - 1] as THREE.Vector3)).toBeLessThan(
          0.0008,
        );
      }
    }
  });

  it('[Req 1.1] sets dark grime into the goo, under or on the surface of the pools, never above them', () => {
    const [grime] = named(phone.goo, 'goo-grime');
    expect(grime).toBeDefined();
    expect((grime as THREE.Mesh).userData['count']).toBeGreaterThanOrEqual(12);
    const pools = named(phone.goo, 'goo-pool').map((pool) => ({
      origin: pool.getWorldPosition(new THREE.Vector3()),
      top: Math.max(...worldVertices(pool).map(height)),
    }));
    for (const v of worldVertices(grime as THREE.Mesh)) {
      const nearest = pools.reduce((a, b) =>
        inPlaneDistance(v, a.origin) < inPlaneDistance(v, b.origin) ? a : b,
      );
      expect(phone.dial.isOpen(radiusInDial(v, phone.dial), angleInDial(v, phone.dial))).toBe(true);
      expect(height(v)).toBeLessThanOrEqual(nearest.top + 0.00006);
      expect(height(v)).toBeGreaterThan(height(nearest.origin));
    }
  });

  it('[Req 1.1] puts bubbles in some pools and not others', () => {
    const counts = named(phone.goo, 'goo-pool').map(
      (p) => (p.geometry.userData['bubbles'] as unknown[]).length,
    );
    expect(counts.filter((c) => c > 0).length).toBeGreaterThanOrEqual(2);
    expect(counts.filter((c) => c === 0).length).toBeGreaterThanOrEqual(2);
    for (const c of counts) expect(c).toBeLessThanOrEqual(3);
  });

  it('[Req 1.1] ends the run in a small puddle lying flat on the desk', () => {
    const [puddle] = named(phone.bodyGoo, 'goo-puddle');
    expect(puddle).toBeDefined();
    const vertices = worldVertices(puddle as THREE.Mesh);
    for (const v of vertices) {
      expect(v.y).toBeGreaterThan(0.0005);
      expect(v.y).toBeLessThan(0.0018);
    }
    const ribbon = named(phone.bodyGoo, 'goo-run').find(
      (r) => r.userData['part'] === 'ribbon',
    ) as THREE.Mesh;
    const path = ribbon.userData['path'] as THREE.Vector3[];
    const end = path[path.length - 1] as THREE.Vector3;
    const middle = centreOf(vertices);
    expect(Math.hypot(middle.x - end.x, middle.z - end.z)).toBeLessThan(0.008);
  });

  it('[Req 1.1] keeps every piece of goo off the 1023 card', () => {
    for (const root of [phone.goo, phone.bodyGoo]) {
      root.traverse((o) => {
        if (!(o as THREE.Mesh).isMesh) return;
        for (const v of worldVertices(o as THREE.Mesh)) {
          expect(radiusInDial(v, phone.dial), o.name).toBeGreaterThan(cardRadius() + 0.0005);
        }
      });
    }
    for (const stroke of [...phone.decals.film.strokes, ...phone.decals.prints]) {
      expect(strokeRadii(stroke).inner).toBeGreaterThan(cardRadius() + 0.0005);
    }
  });

  it('[Req 1.1] lays a film over only the top face of the wheel, as a child of the wheel, mapped flat', () => {
    const film = phone.decals.wheelFilm;
    expect(film.parent).toBe(phone.wheel);
    expect(film.position.length()).toBe(0);
    film.updateWorldMatrix(true, false);
    const position = film.geometry.getAttribute('position');
    const index = film.geometry.getIndex() as THREE.BufferAttribute;
    expect(index.count).toBeGreaterThan(300);
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    const c = new THREE.Vector3();
    for (let i = 0; i < index.count; i += 3) {
      a.fromBufferAttribute(position, index.getX(i)).applyMatrix4(film.matrixWorld);
      b.fromBufferAttribute(position, index.getX(i + 1)).applyMatrix4(film.matrixWorld);
      c.fromBufferAttribute(position, index.getX(i + 2)).applyMatrix4(film.matrixWorld);
      const n = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
      expect(Math.abs(n.dot(phone.dial.normal))).toBeGreaterThan(0.3);
    }
    const uv = film.geometry.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) {
      expect(uv.getX(i)).toBeGreaterThanOrEqual(0);
      expect(uv.getX(i)).toBeLessThanOrEqual(1);
    }
  });

  it('[Req 1.1] gives the number plate its own flat goo mapping, leaving the cached model alone', () => {
    const plate = phone.plate as THREE.Mesh;
    expect(plate.geometry.getAttribute('gooUv')).toBeDefined();
    const original = descendantsNamed(source, plate.name)[0] as THREE.Mesh;
    expect(original.geometry.getAttribute('gooUv')).toBeUndefined();
  });

  it('[Req 1.1] mixes fresh, glossy goo with dried crust', () => {
    const crusts: number[] = [];
    for (const root of [phone.goo, phone.bodyGoo]) {
      root.traverse((o) => {
        const crust = (o as THREE.Mesh).geometry?.getAttribute('crust');
        if (crust) for (let i = 0; i < crust.count; i++) crusts.push(crust.getX(i));
      });
    }
    expect(crusts.some((c) => c < 0.1)).toBe(true);
    expect(crusts.some((c) => c > 0.8)).toBe(true);
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
