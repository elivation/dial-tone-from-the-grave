import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act } from 'react';
import * as THREE from 'three';
import {
  createRoot,
  extend,
  _roots,
  type ReconcilerRoot,
  type RootState,
  type ThreeEvent,
} from '@react-three/fiber';
import type { BusinessResult } from '@/lib/listingSearch';
import { PhoneBook3D } from './PhoneBook3D';
import { createCoverTextures, createPageTextures } from './bookTextures';
import type { PageHit } from './bookHits';

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

type TextureSet = {
  left: THREE.Texture;
  right: THREE.Texture;
  hits: { left: PageHit[]; right: PageHit[] };
  dispose: ReturnType<typeof vi.fn>;
};
let textureSets: TextureSet[];
/** What the mocked painting says is clickable. Tests change it before showing the book. */
let hits: TextureSet['hits'];
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
  hits = { left: [], right: [] };
  vi.mocked(createPageTextures).mockImplementation(() => {
    const set = {
      left: new THREE.CanvasTexture(document.createElement('canvas')),
      right: new THREE.CanvasTexture(document.createElement('canvas')),
      hits,
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

  it('[Req 13.3] paints the pencil rings and the folded corner from the called ids and dog-ear', async () => {
    await show(
      <PhoneBook3D results={[listing]} activeSection="business" calledIds={['b1']} dogEared />,
    );
    expect(vi.mocked(createPageTextures).mock.calls.at(-1)?.[2]).toEqual({
      calledIds: ['b1'],
      dogEared: true,
    });
  });

  it('[Req 13.3] paints no ring and no fold for a book nobody has called from', async () => {
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    expect(vi.mocked(createPageTextures).mock.calls.at(-1)?.[2]).toEqual({
      calledIds: [],
      dogEared: false,
    });
  });

  it('[Req 13.3] repaints once, and frees the old pages, when a listing is called', async () => {
    const results = [listing];
    await show(<PhoneBook3D results={results} activeSection="business" />);
    const calls = vi.mocked(createPageTextures).mock.calls.length;
    await update(
      <PhoneBook3D results={results} activeSection="business" calledIds={['b1']} dogEared />,
    );
    expect(vi.mocked(createPageTextures).mock.calls.length).toBe(calls + 1);
    expect(textureSets[0]?.dispose).toHaveBeenCalled();
  });

  it('[Req 13.2] repaints for a different page of the book', async () => {
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    const calls = vi.mocked(createPageTextures).mock.calls.length;
    await update(<PhoneBook3D results={[{ ...listing, id: 'b2' }]} activeSection="business" />);
    expect(vi.mocked(createPageTextures).mock.calls.length).toBe(calls + 1);
  });
});

type Handlers = {
  onClick?: (event: ThreeEvent<MouseEvent>) => void;
  onPointerMove?: (event: ThreeEvent<PointerEvent>) => void;
  onPointerOut?: (event: ThreeEvent<PointerEvent>) => void;
};

/** The handlers fiber calls when the pointer hits a page, so a test can aim at a point on it. */
function pageHandlers(side: 'left' | 'right'): Handlers {
  const mesh = scene().getObjectByName(`page-${side}`) as
    | (THREE.Object3D & { __r3f?: { handlers: Handlers } })
    | undefined;
  if (!mesh?.__r3f) throw new Error(`no ${side} page`);
  return mesh.__r3f.handlers;
}
const at = (u: number, v: number) => ({ uv: new THREE.Vector2(u, v) });
const click = (side: 'left' | 'right', u: number, v: number) =>
  pageHandlers(side).onClick?.(at(u, v) as unknown as ThreeEvent<MouseEvent>);
const cursor = () => (_roots.get(canvas)?.store.getState() as RootState).gl.domElement.style.cursor;

describe('PhoneBook3D clicks', () => {
  const rect: PageHit = { id: 'b1', u0: 0.2, u1: 0.8, v0: 0.4, v1: 0.6 };

  it('[Req 13.2] clicking a listing on the page opens it', async () => {
    hits = { left: [rect], right: [] };
    const onOpenListing = vi.fn();
    await show(
      <PhoneBook3D results={[listing]} activeSection="business" onOpenListing={onOpenListing} />,
    );
    act(() => click('left', 0.5, 0.5));
    expect(onOpenListing).toHaveBeenCalledWith('b1');
  });

  it('[Req 13.2] clicking the right page opens a listing on it, not the next page', async () => {
    hits = { left: [], right: [rect] };
    const onOpenListing = vi.fn();
    const onFlip = vi.fn();
    await show(
      <PhoneBook3D
        results={[listing]}
        activeSection="business"
        onOpenListing={onOpenListing}
        onFlip={onFlip}
      />,
    );
    act(() => click('right', 0.5, 0.5));
    expect(onOpenListing).toHaveBeenCalledWith('b1');
    expect(onFlip).not.toHaveBeenCalled();
  });

  it('[Req 13.2] clicking bare paper flips back on the left page and forward on the right', async () => {
    hits = { left: [rect], right: [rect] };
    const onOpenListing = vi.fn();
    const onFlip = vi.fn();
    await show(
      <PhoneBook3D
        results={[listing]}
        activeSection="business"
        onOpenListing={onOpenListing}
        onFlip={onFlip}
      />,
    );
    act(() => click('left', 0.05, 0.9));
    act(() => click('right', 0.05, 0.9));
    expect(onFlip.mock.calls).toEqual([[-1], [1]]);
    expect(onOpenListing).not.toHaveBeenCalled();
  });

  it('[Req 13.2] a click with no point on the page does nothing', async () => {
    const onFlip = vi.fn();
    await show(<PhoneBook3D results={[listing]} activeSection="business" onFlip={onFlip} />);
    act(() => pageHandlers('left').onClick?.({} as unknown as ThreeEvent<MouseEvent>));
    expect(onFlip).not.toHaveBeenCalled();
  });

  it('[Req 13.2] shows a pointer over a listing and the normal cursor off it, without repainting', async () => {
    hits = { left: [rect], right: [] };
    await show(<PhoneBook3D results={[listing]} activeSection="business" />);
    const paints = vi.mocked(createPageTextures).mock.calls.length;
    const move = (u: number, v: number) =>
      act(() =>
        pageHandlers('left').onPointerMove?.(at(u, v) as unknown as ThreeEvent<PointerEvent>),
      );
    move(0.5, 0.5);
    expect(cursor()).toBe('pointer');
    move(0.51, 0.5);
    move(0.05, 0.9);
    expect(cursor()).toBe('');
    move(0.5, 0.5);
    act(() => pageHandlers('left').onPointerOut?.({} as unknown as ThreeEvent<PointerEvent>));
    expect(cursor()).toBe('');
    expect(vi.mocked(createPageTextures).mock.calls.length).toBe(paints);
  });

  it('[Req 13.2] hints that the page turns where a flip is possible', async () => {
    await show(
      <PhoneBook3D
        results={[listing]}
        activeSection="business"
        canFlip={{ previous: true, next: false }}
      />,
    );
    const move = (side: 'left' | 'right') =>
      act(() =>
        pageHandlers(side).onPointerMove?.(at(0.05, 0.9) as unknown as ThreeEvent<PointerEvent>),
      );
    move('left');
    expect(cursor()).toBe('w-resize');
    move('right');
    expect(cursor()).toBe('');
  });
});
