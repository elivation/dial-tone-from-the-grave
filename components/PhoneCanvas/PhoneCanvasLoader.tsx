'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { DialController } from '@/components/RotaryDial/useDialController';
import { ScenePoster } from '@/components/ScenePoster/ScenePoster';
import { LoadingVeil } from './LoadingVeil';
import type { BookView } from './PhoneBook3D';
import { hasWebGL } from './webgl';

// The 3D scene only exists in the browser, so it is loaded client-side. The import runs when
// the component first renders, which is not until `active`, so the three.js chunk is not fetched
// while the poster is all there is to show.
const PhoneCanvas = dynamic(() => import('./PhoneCanvas'), { ssr: false });

const subscribeNever = () => () => {};
const assumeWebGL = () => true;

type Props = {
  /** Drives the finger wheel and hears the digits. */
  controller: DialController;
  /** False until the first interaction. The poster shows, and the scene is neither loaded nor run. */
  active: boolean;
  /** Called once when the scene has drawn, or when there is no WebGL and it never will. */
  onSettled?: () => void;
  /** Shown over the poster when the browser has no WebGL. */
  fallback?: ReactNode;
  /** The phone book to lay on the desk. Left out when there is none. */
  book?: BookView | undefined;
};

/** The haunted desk: a still poster until `active`, then the 3D phone fading in over it. */
export function PhoneCanvasLoader({ controller, active, onSettled, fallback = null, book }: Props) {
  // Asking for a WebGL context is itself work, so it waits for the first interaction too.
  const supported = useSyncExternalStore(subscribeNever, () => !active || hasWebGL(), assumeWebGL);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);
  const stuck = active && !supported;

  useEffect(() => {
    if (ready || stuck) onSettled?.();
  }, [ready, stuck, onSettled]);

  return (
    <div className="relative h-full w-full">
      {active && supported && (
        <div aria-hidden="true" className="absolute inset-0 touch-none">
          <PhoneCanvas onReady={onReady} controller={controller} book={book} />
        </div>
      )}
      <ScenePoster hidden={ready} />
      <div
        aria-hidden="true"
        className="scene-vignette scene-vignette-flicker pointer-events-none absolute inset-0 z-[6]"
      />
      <div aria-hidden="true" className="scene-grain pointer-events-none absolute inset-0 z-[6]" />
      {active && supported && <LoadingVeil visible={!ready} />}
      {stuck && <div className="absolute inset-0 z-10">{fallback}</div>}
    </div>
  );
}
