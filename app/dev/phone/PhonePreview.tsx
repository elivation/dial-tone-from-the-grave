'use client';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import type { DialController } from '@/components/RotaryDial/useDialController';

/** The wheel follows the finger exactly while dragging, so a held 'dragging' phase pins it at `wheel` degrees. */
export function PhonePreview({ wheel }: { wheel: number }) {
  const controller: DialController = {
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
  return (
    <main className="h-screen w-screen bg-black">
      <PhoneCanvasLoader controller={controller} />
    </main>
  );
}
