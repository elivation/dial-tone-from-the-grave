'use client';
import { useState, useSyncExternalStore } from 'react';
import { getAudioEngine, type AudioEngine } from '@/lib/audio';

export type MuteControl = Pick<AudioEngine, 'isMuted' | 'setMuted'>;

const subscribeNever = () => () => {};
// The server has no session, so it always renders muted. The client then shows the remembered choice.
const mutedOnServer = () => true;

/** Sound on or off. Starts muted. The engine remembers the choice for the session. */
export function MuteToggle({ audio }: { audio?: MuteControl }) {
  const engine = () => audio ?? getAudioEngine();
  const remembered = useSyncExternalStore(subscribeNever, () => engine().isMuted(), mutedOnServer);
  const [chosen, setChosen] = useState<boolean | null>(null);
  const muted = chosen ?? remembered;
  const toggle = () => {
    engine().setMuted(!muted);
    setChosen(!muted);
  };
  return (
    <button
      type="button"
      onClick={toggle}
      className="pointer-events-auto rounded border border-amber-200/40 bg-black/70 px-4 py-1 font-serif text-sm tracking-widest text-amber-200/90 hover:bg-amber-200/15 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
    >
      {muted ? 'Unmute' : 'Mute'}
    </button>
  );
}
