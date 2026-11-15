'use client';
import { useEffect, useState } from 'react';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useDialController, type DialController } from '@/components/RotaryDial/useDialController';
import { replayPlan } from './replay';

/** The wheel follows the finger exactly while dragging, so a held 'dragging' phase pins it at `wheel` degrees. */
function heldAt(wheel: number): DialController {
  return {
    rotation: wheel,
    phase: 'dragging',
    activeDigit: null,
    disabled: true,
    reducedMotion: false,
    grab: () => false,
    drag: () => {},
    release: () => false,
    press: () => false,
  };
}

const POINTER = 1;

/**
 * Dev preview of the phone. With `dial`, it drags each digit round on the real dial controller,
 * as a finger would, and marks the page `data-replay="done"` when the dial is back at rest.
 * Without it, the wheel is held still at `wheel` degrees.
 */
export function PhonePreview({ wheel, dial }: { wheel: number; dial: string }) {
  const [ready, setReady] = useState(false);
  const [done, setDone] = useState(dial === '');
  const live = useDialController({ disabled: dial === '', onDigit: () => {} });
  const { grab, drag, release } = live;

  useEffect(() => {
    if (dial === '' || !ready) return;
    const plan = replayPlan(dial);
    const timers = plan.map((step) =>
      setTimeout(() => {
        if (step.kind === 'grab') grab(step.digit, step.angle, POINTER);
        else if (step.kind === 'drag') drag(step.angle, POINTER);
        else release(POINTER);
      }, step.at),
    );
    const last = plan.at(-1)?.at ?? 0;
    timers.push(setTimeout(() => setDone(true), last + 1500));
    return () => timers.forEach(clearTimeout);
  }, [dial, ready, grab, drag, release]);

  // Wait for the scene to finish loading before dragging, so no trail is lost.
  useEffect(() => {
    if (dial === '') return;
    const veilGone = () => document.querySelector('[aria-hidden="true"].opacity-0') !== null;
    const poll = setInterval(() => {
      if (veilGone()) {
        clearInterval(poll);
        setReady(true);
      }
    }, 200);
    return () => clearInterval(poll);
  }, [dial]);

  return (
    <main className="h-screen w-screen bg-black" data-replay={done ? 'done' : 'running'}>
      <PhoneCanvasLoader controller={dial === '' ? heldAt(wheel) : live} />
    </main>
  );
}
