'use client';

import { useState } from 'react';
import { DialledDisplay } from '@/components/DialledDisplay/DialledDisplay';
import { PhoneCanvasLoader } from '@/components/PhoneCanvas/PhoneCanvasLoader';
import { useDialController } from '@/components/RotaryDial/useDialController';
import { useDialKeyboard } from '@/components/RotaryDial/useDialKeyboard';

const MAX_SHOWN = 14;

/** The haunted desk and the number being dialled on it. */
export function PhoneScene() {
  const [digits, setDigits] = useState('');
  const controller = useDialController({
    disabled: false,
    onDigit: (digit) => setDigits((soFar) => (soFar + digit).slice(-MAX_SHOWN)),
  });

  useDialKeyboard(controller);

  return (
    <div className="relative h-full w-full">
      <PhoneCanvasLoader
        controller={controller}
        fallback={
          <p className="flex h-full items-center justify-center px-6 text-center font-serif text-amber-200/80">
            This switchboard needs WebGL to show the phone.
          </p>
        }
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 text-center">
        <DialledDisplay digits={digits} />
      </div>
    </div>
  );
}
