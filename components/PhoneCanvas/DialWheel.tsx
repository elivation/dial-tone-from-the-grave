'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { travelDegrees } from '@/lib/dial';
import type { DialController, DialPhase } from '@/components/RotaryDial/useDialController';
import { returnSpeed, stepShown } from './dialMotion';
import { angleInDial, holeAtPoint, pointOnDialPlane } from './dialSpace';
import type { PreparedPhone } from './preparePhone';
import { useGooPainter, usePreparedPhone } from './useDialGeometry';
import { createWheelPivot } from './wheelPivot';

/**
 * True if the thing the pointer hit first is part of the dial, not something standing in front of it.
 * The leak stains lie on the plate under the holes, so a finger in an empty hole may meet one first.
 */
function isDialPart(hit: THREE.Object3D, phone: PreparedPhone): boolean {
  if (/Dial/.test(hit.name)) return true;
  for (let node: THREE.Object3D | null = hit; node && node !== phone.object; node = node.parent) {
    if (node === phone.wheel || node === phone.bodyGoo) return true;
  }
  return false;
}

/**
 * Lets people dial the 3D phone with a finger or a mouse.
 *
 * It turns pointer events on the canvas into calls on the shared dial controller, the same one
 * the 2D dial uses, and turns the finger wheel to match. While a hole is dragged it tells the goo
 * painter how far the wheel has turned, so the hole leaves a trail.
 */
export function DialWheel({ controller }: { controller: DialController }) {
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const phone = usePreparedPhone();
  const painter = useGooPainter();
  const latestPainter = useRef(painter);

  const latest = useRef(controller);
  useLayoutEffect(() => {
    latest.current = controller;
    latestPainter.current = painter;
  });

  const turn = useMemo(() => createWheelPivot(phone.wheel, phone.dial), [phone]);
  const shown = useRef(0);
  const lastPhase = useRef<DialPhase>('idle');
  // Held in a ref so a drag survives the listeners being set up again.
  const activePointer = useRef<number | null>(null);
  /** The digit whose hole is leaving a goo trail, or null when nothing is being dragged. */
  const smudging = useRef<string | null>(null);

  useFrame((_, delta) => {
    const c = latest.current;
    // Let go at the stop means the wheel is at the stop, even if no frame was drawn since the last move.
    if (c.phase === 'returning' && lastPhase.current !== 'returning' && c.activeDigit) {
      shown.current = travelDegrees(c.activeDigit);
    }
    lastPhase.current = c.phase;
    const next = stepShown({
      shown: shown.current,
      target: c.rotation,
      phase: c.phase,
      reducedMotion: c.reducedMotion,
      returnSpeed: c.activeDigit ? returnSpeed(c.activeDigit) : 0,
      dt: delta,
    });
    // Goo is only painted while a finger drags a hole, and only when the wheel has moved.
    const goo = latestPainter.current;
    if (c.phase === 'dragging' && c.activeDigit) {
      if (smudging.current !== c.activeDigit) {
        smudging.current = c.activeDigit;
        goo?.beginDrag(c.activeDigit);
      }
      if (next !== shown.current) goo?.dragTo(next);
    } else if (smudging.current !== null) {
      smudging.current = null;
      goo?.endDrag();
    }
    if (next === shown.current) return;
    shown.current = next;
    turn(next);
  });

  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const aim = (event: PointerEvent): boolean => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      pointer.set(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(pointer, camera);
      return true;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (!aim(event)) return;
      const first = raycaster.intersectObject(phone.object, true)[0];
      if (!first || !isDialPart(first.object, phone)) return;
      const point = pointOnDialPlane(raycaster.ray, phone.dial);
      if (!point) return;
      const digit = holeAtPoint(point, phone.dial);
      if (!digit) return;
      if (!latest.current.grab(digit, angleInDial(point, phone.dial), event.pointerId)) return;
      activePointer.current = event.pointerId;
      event.preventDefault();
      // Keeps the drag going if the finger slips off the canvas. The browser lets go of it at pointer up.
      canvas.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== activePointer.current || !aim(event)) return;
      const point = pointOnDialPlane(raycaster.ray, phone.dial);
      if (point) latest.current.drag(angleInDial(point, phone.dial), event.pointerId);
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId !== activePointer.current) return;
      activePointer.current = null;
      latest.current.release(event.pointerId);
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerEnd);
    canvas.addEventListener('pointercancel', onPointerEnd);
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerEnd);
      canvas.removeEventListener('pointercancel', onPointerEnd);
    };
  }, [gl, camera, phone]);

  return null;
}
