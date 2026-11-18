'use client';
import type { Ref } from 'react';
import type { CallState } from '@/lib/callMachine';
import { usePrefersReducedMotion } from '@/lib/useReducedMotion';

const BUTTON =
  'pointer-events-auto rounded border border-amber-200/50 bg-black/70 px-6 py-2 font-serif text-lg tracking-widest text-amber-200 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200';

/**
 * Pick up and hang up. Owns nothing: the call state and both actions come from the parent. When
 * the phone rings by itself the same button answers it, and it shakes unless motion is reduced.
 */
export function Handset({
  state,
  onPickUp,
  onHangUp,
  buttonRef,
}: {
  state: CallState;
  onPickUp: () => void;
  onHangUp: () => void;
  /** Lets the page put focus here, for example after the phone book is closed. */
  buttonRef?: Ref<HTMLButtonElement>;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const ringing = state.status === 'ringing-in';
  if (state.status === 'idle' || ringing) {
    return (
      <button
        ref={buttonRef}
        type="button"
        className={ringing && !reducedMotion ? `${BUTTON} handset-shake` : BUTTON}
        onClick={onPickUp}
      >
        Pick up the handset
      </button>
    );
  }
  return (
    <button ref={buttonRef} type="button" className={BUTTON} onClick={onHangUp}>
      Hang up
    </button>
  );
}
