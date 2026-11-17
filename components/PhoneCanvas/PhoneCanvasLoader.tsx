'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { DialController } from '@/components/RotaryDial/useDialController';
import { LoadingVeil } from './LoadingVeil';
import type { BookView } from './PhoneBook3D';
import { hasWebGL } from './webgl';

// The 3D scene only exists in the browser, so it is loaded client-side and on demand.
const PhoneCanvas = dynamic(() => import('./PhoneCanvas'), { ssr: false });

const subscribeNever = () => () => {};
const assumeWebGL = () => true;

type Props = {
  /** Drives the finger wheel and hears the digits. */
  controller: DialController;
  /** Shown instead of the scene when the browser has no WebGL. */
  fallback?: ReactNode;
  /** The phone book to lay on the desk. Left out when there is none. */
  book?: BookView | undefined;
};

/** The 3D phone, with a candlelit veil until it is ready. */
export function PhoneCanvasLoader({ controller, fallback = null, book }: Props) {
  const supported = useSyncExternalStore(subscribeNever, hasWebGL, assumeWebGL);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  if (!supported) return <>{fallback}</>;

  return (
    <div className="relative h-full w-full">
      <div aria-hidden="true" className="absolute inset-0 touch-none">
        <PhoneCanvas onReady={onReady} controller={controller} book={book} />
      </div>
      <div aria-hidden="true" className="scene-vignette pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="scene-grain pointer-events-none absolute inset-0" />
      <LoadingVeil visible={!ready} />
    </div>
  );
}
