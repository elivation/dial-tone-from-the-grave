'use client';
import type { CallState } from '@/lib/callMachine';

const BUTTON =
  'pointer-events-auto rounded border border-amber-200/50 bg-black/70 px-6 py-2 font-serif text-lg tracking-widest text-amber-200 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200';

/** Pick up and hang up. Owns nothing: the call state and both actions come from the parent. */
export function Handset({
  state,
  onPickUp,
  onHangUp,
}: {
  state: CallState;
  onPickUp: () => void;
  onHangUp: () => void;
}) {
  if (state.status === 'idle') {
    return (
      <button type="button" className={BUTTON} onClick={onPickUp}>
        Pick up the handset
      </button>
    );
  }
  return (
    <button type="button" className={BUTTON} onClick={onHangUp}>
      Hang up
    </button>
  );
}
