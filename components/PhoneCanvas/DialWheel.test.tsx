import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render } from '@testing-library/react';
import * as THREE from 'three';
import { HOLE_ANGLES, travelDegrees, type Digit } from '@/lib/dial';
import { useDialController } from '@/components/RotaryDial/useDialController';
import { angleGap, makeDial } from './__fixtures__/dial';
import { angleInDial } from './dialSpace';
import { DialWheel } from './DialWheel';
import { GooPainterContext } from './useDialGeometry';
import type { GooPainter } from './gooPainter';
import type { PreparedPhone } from './preparePhone';

// The real scene needs WebGL. These tests keep everything else real: the controller, the DOM
// pointer events, the camera rays and the raycasting. Only the React Three Fiber hooks and the
// loaded model are stood in for.
const shared = vi.hoisted(() => ({
  canvas: document.createElement('canvas'),
  gl: null as unknown,
  camera: null as unknown,
  phone: null as unknown,
  frame: null as ((state: unknown, delta: number) => void) | null,
}));

vi.mock('@react-three/fiber', () => ({
  useThree: (select: (state: unknown) => unknown) =>
    select({ gl: shared.gl, camera: shared.camera }),
  useFrame: (callback: (state: unknown, delta: number) => void) => {
    shared.frame = callback;
  },
}));
vi.mock('./useDialGeometry', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./useDialGeometry')>()),
  usePreparedPhone: () => shared.phone,
}));

const SIZE = 800;
const dial = makeDial(true);
let marker: THREE.Object3D;
let object: THREE.Group;
let wheel: THREE.Mesh;

function buildPhone(): PreparedPhone {
  object = new THREE.Group();
  wheel = new THREE.Mesh(
    new THREE.CircleGeometry(dial.radius, 48),
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  wheel.name = 'Rotary_Dial_Finger_Wheel_Glass_0';
  wheel.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dial.normal);
  wheel.position.copy(dial.centre);
  object.add(wheel);
  object.updateMatrixWorld(true);

  marker = new THREE.Object3D();
  marker.position.copy(
    wheel.worldToLocal(
      dial.centre.clone().addScaledVector(dial.uAx, 0.02).addScaledVector(dial.rAx, 0.005),
    ),
  );
  wheel.add(marker);
  object.updateMatrixWorld(true);
  return {
    object,
    dial,
    wheel,
    card: undefined,
    goo: new THREE.Group(),
    bodyGoo: new THREE.Group(),
    plate: undefined,
    // DialWheel never reads the decals. The painter, which does, is tested on its own.
    decals: {} as PreparedPhone['decals'],
  };
}

/** Where on the screen a spot on the dial appears. The camera looks straight at the dial face. */
function clientAt(degrees: number, r: number): { clientX: number; clientY: number } {
  const t = THREE.MathUtils.degToRad(degrees);
  const world = dial.centre
    .clone()
    .addScaledVector(dial.uAx, Math.cos(t) * r)
    .addScaledVector(dial.rAx, Math.sin(t) * r);
  const ndc = world.project(shared.camera as THREE.PerspectiveCamera);
  return { clientX: (ndc.x * 0.5 + 0.5) * SIZE, clientY: (-ndc.y * 0.5 + 0.5) * SIZE };
}

const pointer = { pointerId: 1, pointerType: 'mouse', button: 0 };
const press = (degrees: number, r = dial.holeR, init = pointer) =>
  act(() => void fireEvent.pointerDown(shared.canvas, { ...init, ...clientAt(degrees, r) }));
const slide = (degrees: number) =>
  act(() => void fireEvent.pointerMove(shared.canvas, { ...pointer, ...clientAt(degrees, 0.02) }));
const lift = (degrees: number) =>
  act(() => void fireEvent.pointerUp(shared.canvas, { ...pointer, ...clientAt(degrees, 0.02) }));

/** Drags the hole for `digit` round, clockwise, until it has turned `degrees`, in steps of 10. */
function dragHole(digit: Digit, degrees: number) {
  const start = HOLE_ANGLES[digit];
  press(start);
  for (let turned = 10; turned < degrees; turned += 10) slide(start + turned);
  slide(start + degrees);
}

function Harness({
  onDigit,
  disabled = false,
}: {
  onDigit: (d: Digit) => void;
  disabled?: boolean;
}) {
  const controller = useDialController({ disabled, onDigit });
  return <DialWheel controller={controller} />;
}

beforeEach(() => {
  shared.gl = { domElement: shared.canvas };
  const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 10);
  camera.up.copy(dial.uAx);
  camera.position.copy(dial.centre).addScaledVector(dial.normal, 0.6);
  camera.lookAt(dial.centre);
  camera.updateMatrixWorld(true);
  shared.camera = camera;
  shared.phone = buildPhone();
  shared.frame = null;
  shared.canvas.getBoundingClientRect = () => ({
    left: 0,
    top: 0,
    right: SIZE,
    bottom: SIZE,
    width: SIZE,
    height: SIZE,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe('DialWheel', () => {
  it.each(['mouse', 'touch'])(
    '[Req 1.1, 1.5] dials the digit when a hole is dragged to the stop and let go (%s)',
    (pointerType) => {
      const onDigit = vi.fn();
      render(<Harness onDigit={onDigit} />);
      const init = { ...pointer, pointerType };

      press(HOLE_ANGLES['5'], dial.holeR, init);
      for (let turned = 10; turned < travelDegrees('5'); turned += 10)
        slide(HOLE_ANGLES['5'] + turned);
      slide(HOLE_ANGLES['5'] + travelDegrees('5'));
      lift(HOLE_ANGLES['5'] + travelDegrees('5'));

      expect(onDigit).toHaveBeenCalledTimes(1);
      expect(onDigit).toHaveBeenCalledWith('5');
    },
  );

  it('[Req 1.1] dials every digit from its own hole', () => {
    for (const digit of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'] as const) {
      const onDigit = vi.fn();
      const { unmount } = render(<Harness onDigit={onDigit} />);
      dragHole(digit, travelDegrees(digit));
      lift(HOLE_ANGLES[digit] + travelDegrees(digit));
      expect(onDigit, `digit ${digit}`).toHaveBeenCalledWith(digit);
      unmount();
    }
  });

  it('[Req 1.2] dials nothing when the finger is let go before the stop', () => {
    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} />);
    dragHole('5', 120);
    lift(HOLE_ANGLES['5'] + 120);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('ignores a press on the card in the middle of the dial', () => {
    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} />);
    press(0, 0.003);
    for (let turned = 10; turned <= 180; turned += 10) slide(turned);
    lift(180);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('ignores the right mouse button', () => {
    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} />);
    press(HOLE_ANGLES['1'], dial.holeR, { ...pointer, button: 2 });
    slide(HOLE_ANGLES['1'] + 60);
    lift(HOLE_ANGLES['1'] + 60);
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('ignores a press when the handset is in the way', () => {
    const blocker = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    blocker.name = 'Handset_Western_Electric_500_Material_0';
    blocker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dial.normal);
    blocker.position.copy(dial.centre).addScaledVector(dial.normal, 0.3);
    object.add(blocker);
    object.updateMatrixWorld(true);

    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} />);
    dragHole('1', travelDegrees('1'));
    lift(HOLE_ANGLES['1'] + travelDegrees('1'));
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('[Req 1.1] dials through a hole even when a leak stain on the plate is the first thing hit', () => {
    // In this stand-in the wheel is a solid disc, so put the stain in front of it, where a finger meets it first.
    const stain = new THREE.Mesh(
      new THREE.CircleGeometry(dial.radius, 24),
      new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
    );
    stain.name = 'goo-stain';
    stain.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dial.normal);
    stain.position.copy(dial.centre).addScaledVector(dial.normal, 0.001);
    const phone = shared.phone as PreparedPhone;
    phone.bodyGoo.add(stain);
    object.add(phone.bodyGoo);
    object.updateMatrixWorld(true);
    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} />);
    dragHole('1', travelDegrees('1'));
    lift(HOLE_ANGLES['1'] + travelDegrees('1'));
    expect(onDigit).toHaveBeenCalledWith('1');
  });
  it('[Req 1.1] smudges goo only while a hole is being dragged, never at rest', () => {
    const painter: GooPainter = {
      beginDrag: vi.fn(),
      dragTo: vi.fn(),
      endDrag: vi.fn(),
      dispose: vi.fn(),
    };
    const frame = () => act(() => shared.frame?.(null, 1 / 60));
    render(
      <GooPainterContext.Provider value={painter}>
        <Harness onDigit={() => {}} />
      </GooPainterContext.Provider>,
    );
    for (let i = 0; i < 5; i++) frame();
    expect(painter.beginDrag).not.toHaveBeenCalled();
    expect(painter.dragTo).not.toHaveBeenCalled();
    dragHole('5', 60);
    frame();
    expect(painter.beginDrag).toHaveBeenCalledWith('5');
    expect(painter.beginDrag).toHaveBeenCalledTimes(1);
    const turns = vi.mocked(painter.dragTo).mock.calls.map(([turn]) => turn);
    expect(turns.at(-1)).toBeCloseTo(60, 0);
    // The finger holds still: nothing new to paint, so nothing is painted.
    const before = vi.mocked(painter.dragTo).mock.calls.length;
    frame();
    frame();
    expect(vi.mocked(painter.dragTo).mock.calls.length).toBe(before);
    lift(HOLE_ANGLES['5'] + 60);
    frame();
    expect(painter.endDrag).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 60; i++) frame();
    expect(painter.beginDrag).toHaveBeenCalledTimes(1);
    expect(vi.mocked(painter.dragTo).mock.calls.length).toBe(before);
    expect(painter.endDrag).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onDigit = vi.fn();
    render(<Harness onDigit={onDigit} disabled />);
    dragHole('1', travelDegrees('1'));
    lift(HOLE_ANGLES['1'] + travelDegrees('1'));
    expect(onDigit).not.toHaveBeenCalled();
  });

  it('[Req 1.3] turns the wheel about the dial axis as the finger drags', () => {
    render(<Harness onDigit={vi.fn()} />);
    const before = angleInDial(marker.getWorldPosition(new THREE.Vector3()), dial);

    dragHole('5', 90);
    act(() => shared.frame?.(null, 1 / 60));
    object.updateMatrixWorld(true);

    const after = angleInDial(marker.getWorldPosition(new THREE.Vector3()), dial);
    expect(angleGap(after - before, 90)).toBeLessThan(0.5);
  });

  it('[Req 1.3] runs the wheel back to rest at the pulse rate after a digit', () => {
    vi.useFakeTimers();
    render(<Harness onDigit={vi.fn()} />);
    const rest = marker.getWorldPosition(new THREE.Vector3());

    dragHole('3', travelDegrees('3'));
    lift(HOLE_ANGLES['3'] + travelDegrees('3'));
    act(() => shared.frame?.(null, 1 / 60));
    expect(marker.getWorldPosition(new THREE.Vector3()).distanceTo(rest)).toBeGreaterThan(0.001);

    // Digit 3 is three pulses, so it is home after 300 ms.
    act(() => void vi.advanceTimersByTime(300));
    act(() => shared.frame?.(null, 1 / 60));
    object.updateMatrixWorld(true);
    expect(marker.getWorldPosition(new THREE.Vector3()).distanceTo(rest)).toBeLessThan(1e-6);
  });

  it('takes every listener off the canvas when it is removed', () => {
    const add = vi.spyOn(shared.canvas, 'addEventListener');
    const remove = vi.spyOn(shared.canvas, 'removeEventListener');
    const { unmount } = render(<Harness onDigit={vi.fn()} />);
    expect(add.mock.calls.map(([type]) => type).sort()).toEqual([
      'pointercancel',
      'pointerdown',
      'pointermove',
      'pointerup',
    ]);

    unmount();

    for (const [type, handler] of add.mock.calls)
      expect(remove).toHaveBeenCalledWith(type, handler);
    add.mockRestore();
    remove.mockRestore();
  });
});
