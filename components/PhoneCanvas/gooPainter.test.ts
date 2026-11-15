import { describe, it, expect, beforeEach } from 'vitest';
import * as THREE from 'three';
import { DIGITS, HOLE_ANGLES } from '@/lib/dial';
import type { HoleOpening } from './goo';
import { createGooPainter, type CanvasFactory } from './gooPainter';
import type { PreparedPhone } from './preparePhone';
import { makeDial } from './__fixtures__/dial';

/** A 2D context that accepts every call and draws nothing. jsdom has no canvas of its own. */
function fakeContext(calls: string[]): CanvasRenderingContext2D {
  const target: Record<string, unknown> = {};
  return new Proxy(target, {
    get: (t, key: string) => {
      if (key in t) return t[key];
      if (key === 'createRadialGradient' || key === 'createLinearGradient')
        return () => ({ addColorStop: () => {} });
      return (...args: unknown[]) => {
        calls.push(key);
        void args;
      };
    },
    set: (t, key: string, value) => {
      t[key] = value;
      return true;
    },
  }) as unknown as CanvasRenderingContext2D;
}

let calls: string[];
const createCanvas: CanvasFactory = (size) =>
  ({
    width: size,
    height: size,
    getContext: () => fakeContext(calls),
  }) as unknown as HTMLCanvasElement;

const R = 0.029;
const openings: HoleOpening[] = DIGITS.map((d) => {
  const t = (HOLE_ANGLES[d] * Math.PI) / 180;
  return {
    degrees: HOLE_ANGLES[d],
    x: Math.cos(t) * 0.022,
    y: Math.sin(t) * 0.022,
    radius: 0.00455,
  };
});

function stubPhone(): PreparedPhone {
  const wheel = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial());
  const film = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshPhysicalMaterial());
  film.visible = false;
  wheel.add(film);
  const plateMaterial = new THREE.MeshPhysicalMaterial();
  const plate = new THREE.Mesh(new THREE.BufferGeometry(), plateMaterial);
  const dial = makeDial(true);
  return {
    dial,
    plate,
    wheel,
    decals: {
      openings,
      fullHoles: [0, 4, 7],
      cardRadius: 0.0143,
      plateRadius: 0.0457,
      wheelFilm: film,
      wheelSpace: { extent: R * 1.02, size: 1024 },
      plateSpace: { extent: 0.0462, size: 1024 },
      film: { strokes: [], overflowHoles: [], streakHoles: [] },
      prints: [],
      stopEdge: dial.centre
        .clone()
        .addScaledVector(dial.rAx, 0.02)
        .addScaledVector(dial.uAx, -0.015),
    },
  } as unknown as PreparedPhone;
}

let now = 0;
let phone: PreparedPhone;
beforeEach(() => {
  calls = [];
  now = 0;
  phone = stubPhone();
});

const plateMaps = () => {
  const material = (phone.plate as THREE.Mesh).material as THREE.MeshPhysicalMaterial;
  const uniforms = material.userData['gooUniforms'] as Record<string, { value: THREE.Texture }>;
  return [uniforms['gooPaint']?.value, uniforms['gooSurface']?.value] as THREE.Texture[];
};
const versions = () => plateMaps().map((t) => t.version);

describe('createGooPainter', () => {
  it('[Req 1.1] shows the wheel film and gives the plate its own goo material, leaving the shared one alone', () => {
    const shared = (phone.plate as THREE.Mesh).material;
    createGooPainter(phone, { createCanvas, now: () => now });
    expect(phone.decals.wheelFilm.visible).toBe(true);
    expect((phone.plate as THREE.Mesh).material).not.toBe(shared);
    expect(plateMaps().every((t) => t instanceof THREE.Texture)).toBe(true);
  });

  it('keeps every canvas at 1024 pixels or less', () => {
    const sizes: number[] = [];
    createGooPainter(phone, {
      createCanvas: (size) => {
        sizes.push(size);
        return createCanvas(size);
      },
      now: () => now,
    });
    expect(sizes.length).toBeGreaterThan(0);
    for (const size of sizes) expect(size).toBeLessThanOrEqual(1024);
  });

  it('[Req 1.1] never touches the textures at rest', () => {
    const painter = createGooPainter(phone, { createCanvas, now: () => now });
    const before = versions();
    painter.dragTo(40);
    now += 1000;
    painter.endDrag();
    expect(versions()).toEqual(before);
  });

  it('[Req 1.1] paints the trail while a hole is dragged, uploading at most every 50 ms', () => {
    const painter = createGooPainter(phone, { createCanvas, now: () => now });
    const before = versions()[0] as number;
    painter.beginDrag('5');
    for (let turn = 2; turn <= 40; turn += 2) painter.dragTo(turn);
    expect((versions()[0] as number) - before).toBe(1);
    now += 60;
    painter.dragTo(60);
    expect((versions()[0] as number) - before).toBe(2);
    painter.dragTo(70);
    painter.endDrag();
    expect((versions()[0] as number) - before).toBe(3);
  });

  it('[Req 1.1] stops adding goo once the trail is at its cap, so the plate is never covered', () => {
    const painter = createGooPainter(phone, { createCanvas, now: () => now });
    for (let i = 0; i < 20; i++) {
      painter.beginDrag('0');
      for (let turn = 5; turn <= 330; turn += 5) painter.dragTo(turn);
      now += 100;
      painter.endDrag();
    }
    const before = versions();
    painter.beginDrag('0');
    for (let turn = 5; turn <= 330; turn += 5) painter.dragTo(turn);
    now += 100;
    painter.endDrag();
    expect(versions()).toEqual(before);
  });

  it('[Req 1.1] dirties the wheel face too, so a dialled phone looks dirtier than one at rest', () => {
    const painter = createGooPainter(phone, { createCanvas, now: () => now });
    const material = phone.decals.wheelFilm.material as THREE.MeshPhysicalMaterial;
    const before = (material.map as THREE.Texture).version;
    painter.beginDrag('3');
    for (let turn = 5; turn <= 120; turn += 5) painter.dragTo(turn);
    now += 100;
    painter.endDrag();
    expect((material.map as THREE.Texture).version).toBeGreaterThan(before);
  });

  it('puts the shared plate material back when disposed', () => {
    const shared = (phone.plate as THREE.Mesh).material;
    const painter = createGooPainter(phone, { createCanvas, now: () => now });
    painter.dispose();
    expect((phone.plate as THREE.Mesh).material).toBe(shared);
    expect(phone.decals.wheelFilm.visible).toBe(false);
  });
});
