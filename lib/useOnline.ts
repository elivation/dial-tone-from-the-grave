'use client';
import { useSyncExternalStore } from 'react';

function subscribe(onChange: () => void): () => void {
  window.addEventListener('online', onChange);
  window.addEventListener('offline', onChange);
  return () => {
    window.removeEventListener('online', onChange);
    window.removeEventListener('offline', onChange);
  };
}

const getSnapshot = (): boolean => window.navigator.onLine;
// The server cannot know, so the first render assumes a connection and the client corrects it.
const getServerSnapshot = (): boolean => true;

/** False while the browser reports no network. Follows the online and offline events. */
export function useOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
