'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Keeps the 3D scene asleep until somebody touches the page. The first pointer press or key press
 * wakes it. Pressing Pick up the handset wakes it too and, because the phone cannot be picked up
 * before the scene can show it, holds the pick up until the scene says it has settled. That way
 * one press is enough.
 *
 * A number key only wakes the scene. The phone is on its hook then, so the digit has nowhere to go
 * and is dropped, the same as on the live phone.
 */
export function useSceneGate(pickUp: () => void) {
  const [active, setActive] = useState(false);
  const [settled, setSettled] = useState(false);
  const waiting = useRef(false);

  useEffect(() => {
    if (active) return;
    const wake = () => setActive(true);
    window.addEventListener('pointerdown', wake, { once: true });
    window.addEventListener('keydown', wake, { once: true });
    return () => {
      window.removeEventListener('pointerdown', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [active]);

  useEffect(() => {
    if (!settled || !waiting.current) return;
    waiting.current = false;
    pickUp();
  }, [settled, pickUp]);

  const requestPickUp = useCallback(() => {
    if (settled) {
      pickUp();
      return;
    }
    waiting.current = true;
    setActive(true);
  }, [settled, pickUp]);

  const onSettled = useCallback(() => setSettled(true), []);

  return { active, requestPickUp, onSettled };
}
