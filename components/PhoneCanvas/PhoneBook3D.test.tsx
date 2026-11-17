import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import * as THREE from 'three';
import {
  createRoot,
  extend,
  _roots,
  type ReconcilerRoot,
  type RootState,
} from '@react-three/fiber';
import type { BusinessResult } from '@/lib/listingSearch';
import { PhoneBook3D } from './PhoneBook3D';
import { createCoverTextures, createPageTextures } from './bookTextures';

// There is no WebGL in jsdom. The painting is stood in for at the boundary, and the renderer is a
// stub, so what is under test is the scene the component builds and how it reacts to its props.
vi.mock('./bookTextures', () => ({
  createPageTextures: vi.fn(),
  createCoverTextures: vi.fn(),
}));

declare global {
  // React reads this flag to allow act() outside a test framework it recognises.
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const listing: BusinessResult = {
  id: 'b1',
  name: 'Geyser Gabriel',
  category: 'plumber',
  suburb: 'Edenvale',
  address: '1 Hollow Lane',
  phone: '011 000 1001',
  dial_number: '61001',
  hours: '24 hours',
  description: 'Geysers',
  is_24hr: true,
  is_advert: false,
  is_spirit: false,
  score: 1,
};

function stubRenderer() {
  const noop = () => {};
  return {
    render: noop,
    setSize: noop,
    setPixelRatio: noop,
    setClearColor: noop,
    dispose: noop,
    domElement: document.createElement('canvas'),
    shadowMap: { enabled: false, type: 0 },
    outputColorSpace: '',
    toneMapping: 0,
    xr: {
      enabled: false,
      addEventListener: noop,
      removeEventListener: noop,
      setAnimationLoop: noop,
    },
    getPixelRatio: () => 1,
    getSize: (target: THREE.Vector2) => target.set(100, 100),
    info: { autoReset: true, reset: noop },
    capabilities: { getMaxAnisotropy: () => 1 },
    setScissor: noop,
    setViewport: noop,
    setScissorTest: noop,
    getRenderTarget: () => null,
  };
}

let textureSets: Array<{
  left: THREE.Texture;
  right: THREE.Texture;
  dispose: ReturnType<typeof vi.fn>;
}>;
let canvas: HTMLCanvasElement;
let root: ReconcilerRoot<HTMLCanvasElement>;

function scene(): THREE.Scene {
  const root = _roots.get(canvas);
  if (!root) throw new Error('no root');
  return (root.store.getState() as RootState).scene;
}

async function show(ui: React.ReactNode) {
  await act(async () => {
    root = await createRoot(canvas).configure({ gl: stubRenderer() as never, frameloop: 'never' });
    root.render(ui);
  });
}

async function update(ui: React.ReactNode) {
  await act(async () => {
    root.render(ui);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // fiber fills its catalogue from its own copy of three, which vitest may not share with this file.
  extend(THREE as never);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  canvas = document.createElement('canvas');
  textureSets = [];
  vi.mocked(createPageTextures).mockImplementation(() => {
    const set = {
      left: new THREE.CanvasTexture(document.createElement('canvas')),
      right: new THREE.CanvasTexture(document.createElement('canvas')),
      dispose: vi.fn(),
    };
    textureSets.push(set);
    return set;
  });
  vi.mocked(createCoverTextures).mockImplementation(() => ({
    edge: new THREE.CanvasTexture(document.createElement('canvas')),
    cover: new THREE.CanvasTexture(document.createElement('canvas')),
    dispose: vi.fn(),
  }));
});

afterEach(async () => {
  await act(async () => {
    if (_roots.has(canvas)) root.unmount();
  });
});

describe('PhoneBook3D', () => {
  it('[Req 5.3] renders the open book, with shadows, when WebGL is mocked', async () => {
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    const book = scene().getObjectByName('phone-book');
    expect(book).toBeDefined();
    const meshes: THREE.Mesh[] = [];
    book?.traverse((o) => {
      if (o instanceof THREE.Mesh) meshes.push(o);
    });
    expect(meshes.length).toBeGreaterThanOrEqual(7);
    expect(meshes.every((m) => m.castShadow)).toBe(true);
  });

  it('[Req 9.9] opens the book, with its empty page painted, when the search found nothing', async () => {
    await show(<PhoneBook3D results={[]} activeSection="business" />);
    expect(scene().getObjectByName('phone-book')).toBeDefined();
    expect(vi.mocked(createPageTextures).mock.calls.at(-1)?.[0]).toEqual([]);
  });

  it('[Req 6.1] switches layout when activeSection changes, and frees the old pages', async () => {
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    expect(vi.mocked(createPageTextures).mock.calls.at(-1)?.[1]).toBe('business');
    await update(<PhoneBook3D results={[listing]} activeSection="white" />);
    expect(vi.mocked(createPageTextures).mock.calls.at(-1)?.[1]).toBe('white');
    expect(textureSets[0]?.dispose).toHaveBeenCalled();
  });

  it('[Req 5.3] does not repaint the pages when nothing about the book changed', async () => {
    const results = [listing];
    await show(<PhoneBook3D results={results} activeSection="business" />);
    const calls = vi.mocked(createPageTextures).mock.calls.length;
    await update(<PhoneBook3D results={results} activeSection="business" />);
    expect(vi.mocked(createPageTextures).mock.calls.length).toBe(calls);
  });

  it('[Req 5.3] frees the textures when the book goes away', async () => {
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    // The parent takes the book away by no longer mounting it (closeBook), not by emptying it.
    await update(<></>);
    expect(textureSets.every((s) => s.dispose.mock.calls.length > 0)).toBe(true);
  });
});
