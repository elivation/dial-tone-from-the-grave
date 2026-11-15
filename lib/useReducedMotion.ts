'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(QUERY);
  media?.addEventListener('change', onChange);
  return () => media?.removeEventListener('change', onChange);
}

const getSnapshot = (): boolean => window.matchMedia?.(QUERY).matches === true;
const getServerSnapshot = (): boolean => false;

/** True when the visitor asked their system for less motion. Sound is not affected by it. */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
