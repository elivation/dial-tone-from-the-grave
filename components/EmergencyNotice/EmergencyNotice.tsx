'use client';
import { useEffect, useRef } from 'react';

export const EMERGENCY_MESSAGE =
  'This is a game and cannot call anyone. If you have an emergency, please use a real phone and dial 112 or 10111.';

/**
 * Shown when someone dials a real emergency number. Deliberately plain and out of character:
 * white, black text, no static, no spooky effects.
 */
export function EmergencyNotice({ onDismiss }: { onDismiss: () => void }) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    button.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="emergency-title"
      aria-describedby="emergency-message"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-white p-8 text-center font-sans text-black"
    >
      <h2 id="emergency-title" className="text-2xl font-bold">
        This is a game
      </h2>
      <p id="emergency-message" className="max-w-md text-lg">
        {EMERGENCY_MESSAGE}
      </p>
      <button
        ref={button}
        type="button"
        onClick={onDismiss}
        className="rounded border-2 border-black px-6 py-2 text-lg font-semibold focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
      >
        Dismiss
      </button>
    </div>
  );
}
