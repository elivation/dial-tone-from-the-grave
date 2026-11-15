'use client';

import dynamic from 'next/dynamic';
import { useCallback, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LoadingVeil } from './LoadingVeil';
import { hasWebGL } from './webgl';

// The 3D scene only exists in the browser, so it is loaded client-side and on demand.
const PhoneCanvas = dynamic(() => import('./PhoneCanvas'), { ssr: false });

const subscribeNever = () => () => {};
const assumeWebGL = () => true;

type Props = {
  /** Shown instead of the scene when the browser has no WebGL. */
  fallback?: ReactNode;
};

/** The 3D phone, with a candlelit veil until it is ready. */
export function PhoneCanvasLoader({ fallback = null }: Props) {
  const supported = useSyncExternalStore(subscribeNever, hasWebGL, assumeWebGL);
  const [ready, setReady] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  if (!supported) return <>{fallback}</>;

  return (
    <div className="relative h-full w-full">
      <div aria-hidden="true" className="absolute inset-0 touch-none">
        <PhoneCanvas onReady={onReady} />
      </div>
      <div aria-hidden="true" className="scene-vignette pointer-events-none absolute inset-0" />
      <div aria-hidden="true" className="scene-grain pointer-events-none absolute inset-0" />
      <LoadingVeil visible={!ready} />
    </div>
  );
}
